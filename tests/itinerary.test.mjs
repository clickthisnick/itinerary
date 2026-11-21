import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addEntry,
  addRow,
  applyAction,
  boot,
  changeAction,
  createState,
  formatClock,
  implementAction,
  nextAction,
  padTime,
  paint,
  parseMainEventTime,
  renderRow,
  scheduleHtml,
  startTime,
} from "../itinerary.js";

/**
 * @param {Record<string, string>} [values]
 */
function createDocument(values = {}) {
  /** @type {Record<string, { value?: string, innerText: string, innerHTML: string }>} */
  const fields = {};
  for (const id of [
    "eventName",
    "eventTime",
    "addEventButton",
    "promtTime",
    "changeActionButton",
    "time",
    "timeTable",
  ]) {
    fields[id] = {
      value: values[id] ?? "",
      innerText: "",
      innerHTML: "",
    };
  }
  fields.addEventButton.innerText = "Add Event";
  fields.promtTime.innerText = "When is your event?";
  fields.changeActionButton.innerText = "remove";
  return {
    fields,
    /**
     * @param {string} id
     */
    getElementById(id) {
      return fields[id];
    },
  };
}

/**
 * @param {Date} date
 * @param {number} hour
 * @param {number} minute
 */
function assertHourMinute(date, hour, minute) {
  assert.equal(date.getHours(), hour);
  assert.equal(date.getMinutes(), minute);
  assert.equal(date.getSeconds(), 0);
}

test("padTime and the clock leave hours unpadded", () => {
  assert.equal(padTime(3), "03");
  assert.equal(padTime(10), 10);
  assert.equal(formatClock(new Date(2026, 0, 1, 9, 5, 3)), "9:05:03");
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 0, 0)), "0:00:00");
  assert.equal(formatClock(new Date(2026, 0, 1, 13, 41, 50)), "13:41:50");
});

test("parseMainEventTime keeps the historical hour rules", () => {
  /** @type {string[]} */
  const alerts = [];
  /**
   * @param {string} message
   */
  const notify = (message) => alerts.push(message);

  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("6:30 pm", notify)),
    18,
    30,
  );
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("6:30PM", notify)),
    18,
    30,
  );
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("  7:05 am ", notify)),
    7,
    5,
  );
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("7:05", notify)),
    7,
    5,
  );
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("7:05:30pm", notify)),
    19,
    5,
  );
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("6:30 p.m.", notify)),
    6,
    30,
  );

  // 12am is stored as noon, and 12pm rolls to the next midnight.
  assertHourMinute(
    /** @type {Date} */ (parseMainEventTime("12:00 am", notify)),
    12,
    0,
  );
  const noonPm = /** @type {Date} */ (parseMainEventTime("12:30 pm", notify));
  assert.equal(noonPm.getHours(), 0);
  assert.equal(noonPm.getMinutes(), 30);

  assert.equal(parseMainEventTime("dinner", notify), false);
  assert.deepEqual(alerts, ["incorrect time format"]);
  assert.equal(parseMainEventTime("6:", notify), false);
  assert.equal(alerts.length, 1);

  const invalid = /** @type {Date} */ (parseMainEventTime(":30", notify));
  assert.equal(Number.isNaN(invalid.getTime()), true);
});

test("a main event and later tasks count backwards from the event", () => {
  const state = createState();
  /** @type {string[]} */
  const alerts = [];
  assert.equal(
    addEntry(state, "Dinner", "6:30 pm", (message) => alerts.push(message)),
    true,
  );
  assert.equal(state.mainEventName, "Dinner");
  assert.equal(alerts.length, 0);

  assert.equal(
    addEntry(state, "Travel", "45", () => {}),
    true,
  );
  assert.equal(
    addEntry(state, "Brush Teeth", "5", () => {}),
    true,
  );
  assert.equal(
    addEntry(state, "Oops", "soon", () => {}),
    true,
  );
  assert.equal(Number.isNaN(state.taskMinutes[2]), true);

  const main = /** @type {Date} */ (state.mainEventTime);
  const html = /** @type {string} */ (scheduleHtml(state));
  const travel = new Date(main.getTime() - 45 * 60 * 1000);
  const brush = new Date(main.getTime() - 50 * 60 * 1000);
  assert.match(
    html,
    new RegExp(`Travel[\\s\\S]*${travel.toLocaleTimeString()}`),
  );
  assert.match(
    html,
    new RegExp(`Brush Teeth[\\s\\S]*${brush.toLocaleTimeString()}`),
  );
  assert.match(html, /id="row0"/);
  assert.match(html, /id="row1"/);
  assert.match(html, /id="row103"/);
  assert.match(html, /onclick="implementAction\(0\)"/);
  assert.match(html, />remove</);
  assert.equal(html.includes("visibility: hidden"), false);
});

test("failed main-event times do not change the form", () => {
  const doc = createDocument({ eventName: "Dinner", eventTime: "tomorrow" });
  const state = createState();
  /** @type {string[]} */
  const alerts = [];
  addRow(doc, state, (message) => alerts.push(message));
  assert.deepEqual(alerts, ["incorrect time format"]);
  assert.equal(state.mainEventName, "");
  assert.equal(doc.fields.eventName.value, "Dinner");
  assert.equal(doc.fields.eventTime.value, "tomorrow");
  assert.equal(doc.fields.timeTable.innerHTML, "");
});

test("adding an event clears the inputs and rewrites the prompts", () => {
  const doc = createDocument({ eventName: "Dinner", eventTime: "6:30 pm" });
  const state = createState();
  addRow(doc, state, () => {});
  assert.equal(doc.fields.eventName.value, "");
  assert.equal(doc.fields.eventTime.value, "");
  assert.equal(doc.fields.addEventButton.innerText, "Add Time");
  assert.equal(doc.fields.promtTime.innerText, "How long will it take (min)?");
  assert.match(doc.fields.timeTable.innerHTML, /Dinner/);
  assert.match(doc.fields.timeTable.innerHTML, /visibility: visible/);

  doc.fields.eventName.value = "<b>Travel</b>";
  doc.fields.eventTime.value = "45";
  addRow(doc, state, () => {});
  assert.match(doc.fields.timeTable.innerHTML, /<b>Travel<\/b>/);
});

test("actions cycle remove, down, up, and the main-event button hides", () => {
  assert.equal(nextAction("remove"), "down");
  assert.equal(nextAction("down"), "up");
  assert.equal(nextAction("up"), "remove");

  const doc = createDocument({ eventName: "Dinner", eventTime: "6:30 pm" });
  const state = createState();
  addRow(doc, state, () => {});
  doc.fields.eventName.value = "Travel";
  doc.fields.eventTime.value = "10";
  addRow(doc, state, () => {});

  changeAction(doc, state);
  assert.equal(state.action, "down");
  assert.equal(doc.fields.changeActionButton.innerText, "down");
  assert.match(
    doc.fields.timeTable.innerHTML,
    /id="row101"[^>]*visibility: hidden/,
  );

  changeAction(doc, state);
  assert.equal(doc.fields.changeActionButton.innerText, "up");
  changeAction(doc, state);
  assert.equal(state.action, "remove");
  assert.match(
    doc.fields.timeTable.innerHTML,
    /id="row101"[^>]*visibility: visible/,
  );
});

test("rows move until an edge, and the main event does not move", () => {
  const state = createState();
  addEntry(state, "Dinner", "6:30 pm", () => {});
  addEntry(state, "Travel", "45", () => {});
  addEntry(state, "Brush Teeth", "5", () => {});

  state.action = "down";
  assert.equal(applyAction(state, 0), true);
  assert.deepEqual(state.taskNames, ["Brush Teeth", "Travel"]);
  assert.deepEqual(state.taskMinutes, [5, 45]);
  assert.equal(applyAction(state, 1), false);
  assert.equal(applyAction(state, 102), false);

  state.action = "up";
  assert.equal(applyAction(state, 0), false);
  assert.equal(applyAction(state, 1), true);
  assert.deepEqual(state.taskNames, ["Travel", "Brush Teeth"]);
  assert.equal(applyAction(state, 102), false);

  const doc = createDocument();
  paint(doc, state);
  const before = doc.fields.timeTable.innerHTML;
  implementAction(doc, state, 0);
  assert.equal(doc.fields.timeTable.innerHTML, before);
});

test("removing a task recalculates, and removing the event shows undefined", () => {
  const doc = createDocument({ eventName: "Dinner", eventTime: "6:30 pm" });
  const state = createState();
  addRow(doc, state, () => {});
  doc.fields.eventName.value = "Travel";
  doc.fields.eventTime.value = "45";
  addRow(doc, state, () => {});
  doc.fields.eventName.value = "Brush Teeth";
  doc.fields.eventTime.value = "5";
  addRow(doc, state, () => {});

  implementAction(doc, state, 0);
  assert.deepEqual(state.taskNames, ["Brush Teeth"]);
  const main = /** @type {Date} */ (state.mainEventTime);
  const brush = new Date(main.getTime() - 5 * 60 * 1000);
  assert.match(
    doc.fields.timeTable.innerHTML,
    new RegExp(brush.toLocaleTimeString()),
  );

  implementAction(doc, state, 101);
  assert.equal(state.mainEventName, "");
  assert.equal(state.mainEventTime, "");
  assert.equal(doc.fields.timeTable.innerHTML, "undefined");
  assert.equal(doc.fields.addEventButton.innerText, "Add Event");
  assert.equal(doc.fields.promtTime.innerText, "When is your event?");
});

test("an empty schedule and a rendered row expose the action label", () => {
  const state = createState();
  assert.equal(scheduleHtml(state), undefined);
  const row = renderRow(
    "Dinner",
    new Date(2026, 0, 1, 18, 30, 0),
    100,
    "down",
    true,
  );
  assert.match(row, /visibility: hidden/);
  assert.match(row, />down</);
});

test("the clock schedules the next tick in half a second", () => {
  const doc = createDocument();
  const moment = new Date(2026, 0, 1, 8, 7, 6);
  /** @type {Array<() => void>} */
  const queued = [];
  startTime(
    doc,
    () => moment,
    (callback, delay) => {
      assert.equal(delay, 500);
      queued.push(callback);
      return 1;
    },
  );
  assert.equal(doc.fields.time.innerHTML, "8:07:06");
  assert.equal(queued.length, 1);
  queued[0]();
  assert.equal(queued.length, 2);
});

test("boot wires the page and ignores a document with no form", () => {
  boot();
  boot({ getElementById: () => /** @type {never} */ (null) });

  const doc = createDocument({ eventName: "Dinner", eventTime: "nope" });
  /** @type {string[]} */
  const alerts = [];
  boot(doc, (message) => alerts.push(message));

  /**
   * @type {{
   *   addRow: () => void,
   *   changeAction: () => void,
   *   implementAction: (index: number) => void,
   *   startTime: () => void,
   * }}
   */
  const page = /** @type {any} */ (globalThis);
  page.addRow();
  assert.deepEqual(alerts, ["incorrect time format"]);

  doc.fields.eventTime.value = "6:30 pm";
  page.addRow();
  assert.equal(doc.fields.addEventButton.innerText, "Add Time");

  page.changeAction();
  assert.equal(doc.fields.changeActionButton.innerText, "down");
  page.changeAction();
  page.changeAction();
  assert.equal(doc.fields.changeActionButton.innerText, "remove");

  doc.fields.eventName.value = "Travel";
  doc.fields.eventTime.value = "15";
  page.addRow();
  page.implementAction(0);
  assert.match(doc.fields.timeTable.innerHTML, /Dinner/);
  assert.equal(doc.fields.timeTable.innerHTML.includes("Travel"), false);

  /** @type {Array<() => void>} */
  const queued = [];
  const original = globalThis.setTimeout;
  globalThis.setTimeout = /** @type {typeof setTimeout} */ (
    (
      /** @type {TimerHandler} */ callback,
      /** @type {number | undefined} */ delay,
    ) => {
      assert.equal(delay, 500);
      if (typeof callback === "function") {
        queued.push(/** @type {() => void} */ (callback));
      }
      return 0;
    }
  );
  try {
    page.startTime();
  } finally {
    globalThis.setTimeout = original;
  }
  assert.equal(queued.length, 1);
  assert.match(doc.fields.time.innerHTML, /^\d{1,2}:\d{2}:\d{2}$/);

  const quiet = createDocument();
  boot(quiet);
  page.changeAction();
  assert.equal(quiet.fields.changeActionButton.innerText, "down");
});

test("the pages keep the existing URLs", () => {
  const page = readFileSync("itinerary.html", "utf8");
  const index = readFileSync("index.html", "utf8");
  assert.match(page, /assets\/ceruleanBootswatch\.min\.css/);
  assert.match(page, /src="itinerary\.js"/);
  assert.match(page, /id="promtTime"/);
  assert.match(
    index,
    /https:\/\/www\.clickthisnick\.com\/itinerary\/README\.md/,
  );
  assert.match(index, /# README/);
});
