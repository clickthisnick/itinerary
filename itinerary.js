// @ts-check
/**
 * Itinerary page logic. The HTML calls addRow, changeAction, implementAction,
 * and startTime. Those names stay on purpose.
 */

/**
 * @typedef {"" | Date} MainEventTime
 * @typedef {"remove" | "down" | "up"} RowAction
 * @typedef {{
 *   mainEventTime: MainEventTime,
 *   mainEventName: string,
 *   taskMinutes: number[],
 *   taskNames: string[],
 *   action: RowAction,
 * }} ItineraryState
 * @typedef {{
 *   value?: string,
 *   innerText: string,
 *   innerHTML: string,
 * }} Field
 * @typedef {{ getElementById: (id: string) => Field }} ItineraryDocument
 */

/** @returns {ItineraryState} */
export function createState() {
  return {
    mainEventTime: "",
    mainEventName: "",
    taskMinutes: [],
    taskNames: [],
    action: "remove",
  };
}

/**
 * Hours stay unpadded. Minutes and seconds below 10 get a leading zero.
 * @param {number} value
 * @returns {string | number}
 */
export function padTime(value) {
  if (value < 10) {
    return "0" + value;
  }
  return value;
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function formatClock(date) {
  const hours = date.getHours();
  const minutes = padTime(date.getMinutes());
  const seconds = padTime(date.getSeconds());
  return hours + ":" + minutes + ":" + seconds;
}

/**
 * Parse the main event time the way the page always has.
 * "pm" adds 12 to the hour, including 12pm. Anything else, including 12am, is left as-is.
 * A missing colon alerts. A colon with no minute number does not.
 * @param {string} text
 * @param {(message: string) => void} notify
 * @returns {Date | false}
 */
export function parseMainEventTime(text, notify) {
  if (text.indexOf(":") === -1) {
    notify("incorrect time format");
    return false;
  }

  const normalized = text.trim().toLowerCase();
  const isPm = normalized.endsWith("pm");
  const parts = normalized.split(":");
  let hour = parseInt(parts[0], 10);
  if (isPm) {
    hour += 12;
  }

  const minuteMatch = parts[1].match(/\d+/);
  if (!minuteMatch) {
    return false;
  }

  const minute = parseInt(minuteMatch[0], 10);
  const date = new Date();
  date.setHours(hour);
  date.setMinutes(minute);
  date.setSeconds(0);
  return date;
}

/**
 * @param {string} name
 * @param {Date} dateTime
 * @param {number} index
 * @param {RowAction} action
 * @param {boolean} isMain
 * @returns {string}
 */
export function renderRow(name, dateTime, index, action, isMain) {
  const visibility = isMain && action !== "remove" ? "hidden" : "visible";
  return (
    `<tr><td><h2>${name}</h2></td>` +
    `<td><h2>${dateTime.toLocaleTimeString()}</h2></td>` +
    `<td><button id="row${index}" class="btn btn-danger" type="button" style="visibility: ${visibility};" ` +
    `onclick="implementAction(${index})">${action}</button></td></tr>`
  );
}

/**
 * Tasks are listed in entry order. Each row starts earlier than the main event
 * by the sum of durations up to and including that row.
 * With no main event, this returns undefined. The page writes that as the text "undefined".
 * @param {ItineraryState} state
 * @returns {string | undefined}
 */
export function scheduleHtml(state) {
  if (state.mainEventTime === "") {
    return undefined;
  }

  const mainEventTime = state.mainEventTime;
  let html = "";
  let minutesToSubtract = 0;
  for (let index = 0; index < state.taskNames.length; index += 1) {
    minutesToSubtract += state.taskMinutes[index];
    const taskDateTime = new Date(
      mainEventTime.getTime() - 1000 * minutesToSubtract * 60,
    );
    html += renderRow(
      state.taskNames[index],
      taskDateTime,
      index,
      state.action,
      false,
    );
  }

  html += renderRow(
    state.mainEventName,
    mainEventTime,
    state.taskNames.length + 100,
    state.action,
    true,
  );
  return html;
}

/** @param {RowAction} action @returns {RowAction} */
export function nextAction(action) {
  if (action === "remove") {
    return "down";
  }
  if (action === "down") {
    return "up";
  }
  return "remove";
}

/**
 * @param {string[]} names
 * @param {number[]} minutes
 * @param {number} from
 * @param {number} to
 */
function swapTasks(names, minutes, from, to) {
  const name = names[from];
  names[from] = names[to];
  names[to] = name;

  const duration = minutes[from];
  minutes[from] = minutes[to];
  minutes[to] = duration;
}

/**
 * @param {ItineraryState} state
 * @param {number} index
 * @returns {boolean} false when the click cannot change the list
 */
export function applyAction(state, index) {
  const lastTask = state.taskNames.length - 1;
  const isMainEvent = index > lastTask;

  if (state.action === "remove") {
    if (isMainEvent) {
      state.mainEventName = "";
      state.mainEventTime = "";
      return true;
    }
    state.taskNames.splice(index, 1);
    state.taskMinutes.splice(index, 1);
    return true;
  }

  if (state.action === "down") {
    if (isMainEvent || lastTask < index + 1) {
      return false;
    }
    swapTasks(state.taskNames, state.taskMinutes, index, index + 1);
    return true;
  }

  if (index === 0 || isMainEvent) {
    return false;
  }
  swapTasks(state.taskNames, state.taskMinutes, index, index - 1);
  return true;
}

/**
 * @param {ItineraryState} state
 * @param {string} name
 * @param {string} timeText
 * @param {(message: string) => void} notify
 * @returns {boolean}
 */
export function addEntry(state, name, timeText, notify) {
  if (state.mainEventName === "") {
    const parsed = parseMainEventTime(timeText, notify);
    if (parsed === false) {
      return false;
    }
    state.mainEventName = name;
    state.mainEventTime = parsed;
    return true;
  }

  state.taskMinutes.push(parseInt(timeText, 10));
  state.taskNames.push(name);
  return true;
}

/** @param {ItineraryDocument} doc @param {ItineraryState} state */
export function paint(doc, state) {
  const addingEvent = state.mainEventName === "";
  doc.getElementById("addEventButton").innerText = addingEvent
    ? "Add Event"
    : "Add Time";
  doc.getElementById("promtTime").innerText = addingEvent
    ? "When is your event?"
    : "How long will it take (min)?";
  doc.getElementById("changeActionButton").innerText = state.action;

  const rows = scheduleHtml(state);
  // A missing main event used to assign innerHTML the value undefined, which
  // the browser shows as the word "undefined". Keep that result.
  doc.getElementById("timeTable").innerHTML =
    rows === undefined ? "undefined" : rows;
}

/**
 * @param {ItineraryDocument} doc
 * @param {ItineraryState} state
 * @param {(message: string) => void} notify
 */
export function addRow(doc, state, notify) {
  const nameInput = doc.getElementById("eventName");
  const timeInput = doc.getElementById("eventTime");
  const added = addEntry(
    state,
    nameInput.value ?? "",
    timeInput.value ?? "",
    notify,
  );
  if (!added) {
    return;
  }
  nameInput.value = "";
  timeInput.value = "";
  paint(doc, state);
}

/** @param {ItineraryDocument} doc @param {ItineraryState} state */
export function changeAction(doc, state) {
  state.action = nextAction(state.action);
  paint(doc, state);
}

/**
 * @param {ItineraryDocument} doc
 * @param {ItineraryState} state
 * @param {number} index
 */
export function implementAction(doc, state, index) {
  if (!applyAction(state, index)) {
    return;
  }
  paint(doc, state);
}

/**
 * @param {ItineraryDocument} doc
 * @param {() => Date} now
 * @param {(callback: () => void, delay: number) => unknown} schedule
 */
export function startTime(doc, now, schedule) {
  const tick = () => {
    doc.getElementById("time").innerHTML = formatClock(now());
    schedule(tick, 500);
  };
  tick();
}

/**
 * Wire the page. Does nothing where there is no document, so tests can import this file.
 * @param {{ getElementById: (id: string) => unknown } | undefined} [doc]
 * @param {(message: string) => void} [notify]
 */
export function boot(doc, notify) {
  const pageDoc = /** @type {ItineraryDocument | undefined} */ (
    doc !== undefined ? doc : globalThis.document
  );
  if (!pageDoc || !pageDoc.getElementById("eventName")) {
    return;
  }

  const report = notify ?? globalThis.alert;
  const state = createState();
  const page = /** @type {Record<string, unknown>} */ (globalThis);
  page.addRow = () => addRow(pageDoc, state, report);
  page.changeAction = () => changeAction(pageDoc, state);
  page.implementAction = (/** @type {number} */ index) =>
    implementAction(pageDoc, state, index);
  page.startTime = () =>
    startTime(
      pageDoc,
      () => new Date(),
      (callback, delay) => {
        setTimeout(callback, delay);
      },
    );
}

boot();
