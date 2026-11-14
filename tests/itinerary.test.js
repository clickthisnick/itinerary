const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  emptyModel,
  parseEventTime,
  parseDuration,
  formatClock,
  formatNow,
  promptCopy,
  startSummary,
  buildRows,
  rowControl,
  addEntry,
  applyAction,
  cycleAction,
  modelToQuery,
  modelFromQuery,
} = require("../itinerary.js");

function at(hour, minute) {
  return hour * 60 + minute;
}

describe("parseEventTime", function () {
  it("treats noon and midnight as different times", function () {
    assert.deepEqual(parseEventTime("12:00 PM"), { ok: true, minutes: at(12, 0) });
    assert.deepEqual(parseEventTime("12:00 pm"), { ok: true, minutes: at(12, 0) });
    assert.deepEqual(parseEventTime("12:30 PM"), { ok: true, minutes: at(12, 30) });
    assert.deepEqual(parseEventTime("12:00 AM"), { ok: true, minutes: at(0, 0) });
    assert.deepEqual(parseEventTime("12:15 am"), { ok: true, minutes: at(0, 15) });
  });

  it("accepts 12-hour, 24-hour, and short forms", function () {
    assert.equal(parseEventTime("7:00 PM").minutes, at(19, 0));
    assert.equal(parseEventTime("7:00pm").minutes, at(19, 0));
    assert.equal(parseEventTime("7pm").minutes, at(19, 0));
    assert.equal(parseEventTime("7:00 p.m.").minutes, at(19, 0));
    assert.equal(parseEventTime("  6:05 AM ").minutes, at(6, 5));
    assert.equal(parseEventTime("19:00").minutes, at(19, 0));
    assert.equal(parseEventTime("00:15").minutes, at(0, 15));
    assert.equal(parseEventTime("7:00:00 PM").minutes, at(19, 0));
    assert.equal(parseEventTime("7").minutes, at(7, 0));
  });

  it("rejects times that used to roll into another hour", function () {
    for (const sample of ["7:60", "24:00", "13:00 pm", "7:00:30 pm", "nope", ""]) {
      const result = parseEventTime(sample);
      assert.equal(result.ok, false, sample);
      assert.equal(result.field, "time");
    }
  });

  it("round-trips every minute of the day", function () {
    for (let minutes = 0; minutes < 1440; minutes += 1) {
      const label = formatClock(minutes);
      const parsed = parseEventTime(label);
      assert.equal(parsed.ok, true, label);
      assert.equal(parsed.minutes, minutes, label);
    }
  });
});

describe("formatClock", function () {
  it("labels midnight, noon, and the previous day", function () {
    assert.equal(formatClock(0), "12:00 AM");
    assert.equal(formatClock(at(12, 0)), "12:00 PM");
    assert.equal(formatClock(at(19, 5)), "7:05 PM");
    assert.equal(formatClock(-15), "11:45 PM (previous day)");
    assert.equal(formatClock(-35), "11:25 PM (previous day)");
    assert.equal(formatClock(-1440), "12:00 AM (previous day)");
    assert.equal(formatClock(-1441), "11:59 PM (2 days earlier)");
    assert.equal(formatClock(1440), "12:00 AM (next day)");
    assert.equal(formatClock(1500), "1:00 AM (next day)");
  });
});

describe("formatNow", function () {
  it("pads the local clock", function () {
    assert.equal(formatNow(new Date(2026, 0, 2, 9, 5, 3)), "09:05:03");
    assert.equal(formatNow(new Date(2026, 0, 2, 0, 0, 0)), "00:00:00");
  });
});

describe("parseDuration", function () {
  it("accepts whole minutes and an optional unit", function () {
    assert.deepEqual(parseDuration("15"), { ok: true, minutes: 15 });
    assert.deepEqual(parseDuration("15 minutes"), { ok: true, minutes: 15 });
    assert.deepEqual(parseDuration("1 min"), { ok: true, minutes: 1 });
    assert.deepEqual(parseDuration("1440"), { ok: true, minutes: 1440 });
  });

  it("rejects empty, fractional, zero, and huge values", function () {
    for (const sample of ["", "abc", "10abc", "15.5", "0", "-5", "1441"]) {
      assert.equal(parseDuration(sample).ok, false, sample);
    }
  });
});

describe("schedule", function () {
  it("lists steps in the order they are done", function () {
    const model = emptyModel();
    assert.equal(addEntry(model, "Dinner", "7:00 PM").ok, true);
    assert.equal(addEntry(model, "Brush teeth", "10").ok, true);
    assert.equal(addEntry(model, "Travel", "30 minutes").ok, true);

    const rows = buildRows(model);
    assert.deepEqual(
      rows.map(function (row) {
        return [row.name, row.startLabel];
      }),
      [
        ["Brush teeth", "6:20 PM"],
        ["Travel", "6:30 PM"],
        ["Dinner", "7:00 PM"],
      ]
    );
    assert.equal(startSummary(model), "Start preparing at 6:20 PM for Dinner.");
  });

  it("moves a step that crosses midnight onto the previous day", function () {
    const model = emptyModel();
    addEntry(model, "Flight", "12:15 AM");
    addEntry(model, "Shower", "20");
    addEntry(model, "Drive", "30");
    const rows = buildRows(model);
    assert.equal(rows[0].startLabel, "11:25 PM (previous day)");
    assert.equal(rows[1].startLabel, "11:45 PM (previous day)");
    assert.equal(rows[2].startLabel, "12:15 AM");
  });

  it("keeps an entered name as text, including markup", function () {
    const model = emptyModel();
    const name = '<img src=x onerror="alert(1)">';
    addEntry(model, name, "19:00");
    assert.equal(model.eventName, name);
    assert.equal(buildRows(model)[0].name, name);
  });

  it("does not store a step when the duration is invalid", function () {
    const model = emptyModel();
    addEntry(model, "Dinner", "7:00 PM");
    const result = addEntry(model, "Travel", "soon");
    assert.equal(result.ok, false);
    assert.equal(model.steps.length, 0);
    assert.equal(buildRows(model).length, 1);
  });

  it("keeps steps when the event is removed and shows them without times", function () {
    const model = emptyModel();
    addEntry(model, "Dinner", "7:00 PM");
    addEntry(model, "Travel", "30");
    const removed = applyAction(model, 1);
    assert.equal(removed.ok, true);
    assert.equal(model.eventMinutes, null);
    assert.equal(model.steps.length, 1);
    assert.equal(buildRows(model)[0].startLabel, "\u2014");
    assert.match(startSummary(model), /still listed/);
  });

  it("reorders steps and recalculates start times", function () {
    const model = emptyModel();
    addEntry(model, "Dinner", "7:00 PM");
    addEntry(model, "Brush teeth", "10");
    addEntry(model, "Travel", "30");
    model.action = "down";
    const moved = applyAction(model, 0);
    assert.equal(moved.ok, true);
    assert.deepEqual(
      model.steps.map(function (step) {
        return step.name;
      }),
      ["Travel", "Brush teeth"]
    );
    const rows = buildRows(model);
    assert.equal(rows[0].startLabel, "6:20 PM");
    assert.equal(rows[1].startLabel, "6:50 PM");
    assert.match(moved.message, /Moved Brush teeth later/);
  });

  it("refuses to move the first step up or the event", function () {
    const model = emptyModel();
    addEntry(model, "Dinner", "7pm");
    addEntry(model, "Travel", "30");
    model.action = "up";
    assert.equal(applyAction(model, 0).ok, false);
    assert.equal(applyAction(model, 1).ok, false);
    assert.equal(model.steps[0].name, "Travel");
    const eventRow = buildRows(model)[1];
    assert.equal(rowControl(model, eventRow).textOnly, true);
    model.action = "remove";
    assert.equal(rowControl(model, eventRow).label, "Remove");
  });

  it("cycles row actions", function () {
    const model = emptyModel();
    assert.equal(cycleAction(model), "down");
    assert.equal(cycleAction(model), "up");
    assert.equal(cycleAction(model), "remove");
  });

  it("switches the prompts after the event is added", function () {
    const model = emptyModel();
    assert.equal(promptCopy(model).button, "Add event");
    addEntry(model, "Dinner", "7:00 PM");
    const copy = promptCopy(model);
    assert.equal(copy.button, "Add step");
    assert.match(copy.timeLabel, /minutes/i);
    assert.match(copy.nameLabel, /before/i);
  });
});

describe("query string", function () {
  it("round-trips names, times, and step order", function () {
    const model = emptyModel();
    addEntry(model, "Dinner & Dance", "7:00 PM");
    addEntry(model, "Brush | floss", "10");
    addEntry(model, "Drive", "30");
    const restored = modelFromQuery(modelToQuery(model));
    assert.deepEqual(restored.errors, []);
    assert.equal(restored.model.eventName, "Dinner & Dance");
    assert.equal(restored.model.eventMinutes, at(19, 0));
    assert.deepEqual(restored.model.steps, model.steps);
    assert.equal(buildRows(restored.model)[0].startLabel, "6:20 PM");
  });

  it("reports a broken time and still keeps valid steps", function () {
    const restored = modelFromQuery("?event=Dinner&at=nope&step=15%7CTravel");
    assert.equal(restored.model.eventMinutes, null);
    assert.equal(restored.model.steps[0].name, "Travel");
    assert.equal(restored.errors.length > 0, true);
  });

  it("ignores a step that has no duration", function () {
    const restored = modelFromQuery("?step=Travel");
    assert.equal(restored.model.steps.length, 0);
    assert.equal(restored.errors.length, 1);
  });
});
