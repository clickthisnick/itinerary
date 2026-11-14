// Itinerary planner.
// Pure helpers are exercised by node:test. Loaded as a classic script, this
// file also mounts the page in itinerary.html.

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (typeof document !== "undefined") {
    var start = function () {
      api.mount(document);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }
  root.Itinerary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ACTIONS = ["remove", "down", "up"];
  var ACTION_LABELS = {
    remove: "Remove",
    down: "Move down",
    up: "Move up",
  };
  var MAX_NAME = 200;
  var MAX_STEPS = 100;
  var MAX_MINUTES = 1440;
  var DAY_SUFFIX =
    /\s*\((?:previous day|next day|\d+ days earlier|\d+ days later)\)\s*$/i;
  var TIME_PATTERN =
    /^\s*(\d{1,2})\s*(?::\s*(\d{2}))?\s*(?::\s*(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*$/i;
  var DURATION_PATTERN = /^(\d{1,4})\s*(m|min|mins|minute|minutes)?$/i;

  function emptyModel() {
    return {
      eventName: "",
      eventMinutes: null,
      steps: [],
      action: "remove",
    };
  }

  function clip(value) {
    var text = String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim()
      .replace(/\s+/g, " ");
    if (text.length <= 40) {
      return text;
    }
    return text.slice(0, 37) + "...";
  }

  function cleanName(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function parseEventTime(input) {
    var raw = String(input == null ? "" : input);
    var withoutDay = raw.replace(DAY_SUFFIX, "");
    var text = withoutDay.trim();
    if (!text) {
      return {
        ok: false,
        field: "time",
        message: "Enter a time like 7:00 PM or 19:00.",
      };
    }
    var match = text.match(TIME_PATTERN);
    if (!match) {
      return {
        ok: false,
        field: "time",
        message:
          'Could not read "' +
          clip(text) +
          '" as a time. Enter a time like 7:00 PM or 19:00.',
      };
    }
    var hour = Number(match[1]);
    var minute = match[2] == null ? 0 : Number(match[2]);
    var second = match[3] == null ? 0 : Number(match[3]);
    var meridiem = match[4] ? match[4].replace(/\./g, "").toLowerCase() : "";
    if (minute > 59) {
      return {
        ok: false,
        field: "time",
        message: "Minutes must be from 00 to 59.",
      };
    }
    if (second !== 0) {
      return {
        ok: false,
        field: "time",
        message: "Enter hours and minutes, like 7:00 PM.",
      };
    }
    if (meridiem) {
      if (hour < 1 || hour > 12) {
        return {
          ok: false,
          field: "time",
          message: "Use an hour from 1 to 12 with AM or PM.",
        };
      }
      if (meridiem === "am") {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }
    } else if (hour > 23) {
      return {
        ok: false,
        field: "time",
        message: "Use an hour from 0 to 23, or add AM or PM.",
      };
    }
    return { ok: true, minutes: hour * 60 + minute };
  }

  function parseDuration(input) {
    var text = String(input == null ? "" : input).trim();
    if (!text) {
      return {
        ok: false,
        field: "time",
        message: "Enter how many minutes the step takes, such as 15.",
      };
    }
    var match = text.match(DURATION_PATTERN);
    if (!match) {
      return {
        ok: false,
        field: "time",
        message:
          'Could not read "' +
          clip(text) +
          '" as minutes. Enter a whole number of minutes, such as 15.',
      };
    }
    var minutes = Number(match[1]);
    if (minutes < 1) {
      return {
        ok: false,
        field: "time",
        message: "Enter at least 1 minute.",
      };
    }
    if (minutes > MAX_MINUTES) {
      return {
        ok: false,
        field: "time",
        message: "Each step must be 1440 minutes (24 hours) or less.",
      };
    }
    return { ok: true, minutes: minutes };
  }

  function formatClock(totalMinutes) {
    var dayOffset = Math.floor(totalMinutes / 1440);
    var minsInDay = ((totalMinutes % 1440) + 1440) % 1440;
    var hour24 = Math.floor(minsInDay / 60);
    var minute = minsInDay % 60;
    var meridiem = hour24 >= 12 ? "PM" : "AM";
    var hour12 = hour24 % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }
    var label =
      hour12 + ":" + String(minute).padStart(2, "0") + " " + meridiem;
    if (dayOffset === 0) {
      return label;
    }
    if (dayOffset === -1) {
      return label + " (previous day)";
    }
    if (dayOffset === 1) {
      return label + " (next day)";
    }
    if (dayOffset < 0) {
      return label + " (" + Math.abs(dayOffset) + " days earlier)";
    }
    return label + " (" + dayOffset + " days later)";
  }

  function formatNow(date) {
    return (
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0") +
      ":" +
      String(date.getSeconds()).padStart(2, "0")
    );
  }

  function durationLabel(minutes) {
    return minutes === 1 ? "1 minute" : minutes + " minutes";
  }

  function totalPrepMinutes(steps) {
    return steps.reduce(function (sum, step) {
      return sum + step.minutes;
    }, 0);
  }

  function promptCopy(model) {
    if (model.eventMinutes == null) {
      return {
        nameLabel: "What is your event?",
        timeLabel: "When is your event?",
        hint: "Example: 7:00 PM, 7pm, or 19:00.",
        button: "Add event",
        namePlaceholder: "Dinner",
        timePlaceholder: "7:00 PM",
        inputMode: "text",
      };
    }
    return {
      nameLabel: "What do you do before it?",
      timeLabel: "How long will it take (minutes)?",
      hint: "Example: 15 or 15 minutes.",
      button: "Add step",
      namePlaceholder: "Travel",
      timePlaceholder: "30",
      inputMode: "numeric",
    };
  }

  function startSummary(model) {
    if (model.eventMinutes == null) {
      if (model.steps.length === 0) {
        return "Add an event to see when you need to start.";
      }
      return "Add an event to calculate times. Your steps are still listed.";
    }
    if (model.steps.length === 0) {
      return (
        "Be there at " +
        formatClock(model.eventMinutes) +
        " for " +
        model.eventName +
        ". Add steps to see when to start preparing."
      );
    }
    var start = model.eventMinutes - totalPrepMinutes(model.steps);
    return (
      "Start preparing at " + formatClock(start) + " for " + model.eventName + "."
    );
  }

  function buildRows(model) {
    if (model.eventMinutes == null) {
      return model.steps.map(function (step, index) {
        return {
          kind: "step",
          index: index,
          name: step.name,
          duration: step.minutes,
          startMinutes: null,
          startLabel: "\u2014",
        };
      });
    }
    var starts = new Array(model.steps.length);
    var remaining = 0;
    for (var i = model.steps.length - 1; i >= 0; i -= 1) {
      remaining += model.steps[i].minutes;
      starts[i] = model.eventMinutes - remaining;
    }
    var rows = model.steps.map(function (step, index) {
      return {
        kind: "step",
        index: index,
        name: step.name,
        duration: step.minutes,
        startMinutes: starts[index],
        startLabel: formatClock(starts[index]),
      };
    });
    rows.push({
      kind: "event",
      index: model.steps.length,
      name: model.eventName,
      duration: null,
      startMinutes: model.eventMinutes,
      startLabel: formatClock(model.eventMinutes),
    });
    return rows;
  }

  function rowControl(model, row) {
    if (row.kind === "event") {
      if (model.action === "remove") {
        return { label: "Remove", disabled: false, textOnly: false };
      }
      return { label: "Stays at the end", disabled: true, textOnly: true };
    }
    if (model.action === "up" && row.index === 0) {
      return { label: "Move up", disabled: true, textOnly: false };
    }
    if (model.action === "down" && row.index === model.steps.length - 1) {
      return { label: "Move down", disabled: true, textOnly: false };
    }
    return {
      label: ACTION_LABELS[model.action],
      disabled: false,
      textOnly: false,
    };
  }

  function withStart(model, lead) {
    if (model.eventMinutes == null) {
      return lead;
    }
    return lead + " " + startSummary(model);
  }

  function parseName(input, label) {
    var name = cleanName(input);
    if (!name) {
      return {
        ok: false,
        field: "name",
        message: "Enter a name for the " + label + ".",
      };
    }
    if (name.length > MAX_NAME) {
      return {
        ok: false,
        field: "name",
        message: "Use a name of 200 characters or fewer.",
      };
    }
    return { ok: true, name: name };
  }

  function addEvent(model, nameInput, timeInput) {
    var name = parseName(nameInput, "event");
    if (!name.ok) {
      return name;
    }
    var time = parseEventTime(timeInput);
    if (!time.ok) {
      return time;
    }
    model.eventName = name.name;
    model.eventMinutes = time.minutes;
    return {
      ok: true,
      message: withStart(
        model,
        "Added " + name.name + " at " + formatClock(time.minutes) + "."
      ),
    };
  }

  function addStep(model, nameInput, durationInput) {
    if (model.steps.length >= MAX_STEPS) {
      return {
        ok: false,
        field: "name",
        message: "This itinerary already has 100 steps.",
      };
    }
    var name = parseName(nameInput, "step");
    if (!name.ok) {
      return name;
    }
    var duration = parseDuration(durationInput);
    if (!duration.ok) {
      return duration;
    }
    model.steps.push({ name: name.name, minutes: duration.minutes });
    return {
      ok: true,
      message: withStart(
        model,
        "Added " + name.name + " (" + durationLabel(duration.minutes) + ")."
      ),
    };
  }

  function addEntry(model, nameInput, timeOrDuration) {
    if (model.eventMinutes == null) {
      return addEvent(model, nameInput, timeOrDuration);
    }
    return addStep(model, nameInput, timeOrDuration);
  }

  function removeAt(model, index) {
    if (model.eventMinutes != null && index === model.steps.length) {
      var name = model.eventName;
      model.eventName = "";
      model.eventMinutes = null;
      return {
        ok: true,
        message:
          "Removed " +
          name +
          ". Add an event to calculate times again.",
      };
    }
    if (index < 0 || index >= model.steps.length) {
      return { ok: false, message: "That row is not in the schedule." };
    }
    var removed = model.steps.splice(index, 1)[0];
    return {
      ok: true,
      message: withStart(model, "Removed " + removed.name + "."),
    };
  }

  function moveStep(model, index, direction) {
    if (index < 0 || index >= model.steps.length) {
      return { ok: false, message: "The event stays at the end." };
    }
    var target = direction === "up" ? index - 1 : index + 1;
    if (target < 0) {
      return { ok: false, message: model.steps[index].name + " is already first." };
    }
    if (target >= model.steps.length) {
      return { ok: false, message: model.steps[index].name + " is already last." };
    }
    var current = model.steps[index];
    model.steps[index] = model.steps[target];
    model.steps[target] = current;
    var verb = direction === "up" ? "earlier" : "later";
    return {
      ok: true,
      message: withStart(model, "Moved " + current.name + " " + verb + "."),
    };
  }

  function applyAction(model, index) {
    if (model.action === "remove") {
      return removeAt(model, index);
    }
    if (model.action === "down" || model.action === "up") {
      return moveStep(model, index, model.action);
    }
    return { ok: false, message: "Choose remove, move down, or move up." };
  }

  function cycleAction(model) {
    var index = ACTIONS.indexOf(model.action);
    model.action = ACTIONS[(index + 1) % ACTIONS.length];
    return model.action;
  }

  function modelToQuery(model) {
    var params = new URLSearchParams();
    if (model.eventName && model.eventMinutes != null) {
      params.set("event", model.eventName);
      params.set("at", formatClock(model.eventMinutes));
    }
    model.steps.forEach(function (step) {
      params.append("step", step.minutes + "|" + step.name);
    });
    return params.toString();
  }

  function modelFromQuery(search) {
    var params = new URLSearchParams(search || "");
    var model = emptyModel();
    var errors = [];
    var eventName = cleanName(params.get("event"));
    var atText = params.get("at");
    var hasAt = atText != null && atText.trim() !== "";
    if (eventName && hasAt) {
      var parsed = parseEventTime(atText);
      if (!parsed.ok) {
        errors.push(parsed.message);
      } else {
        model.eventName = eventName;
        model.eventMinutes = parsed.minutes;
      }
    } else if (eventName || hasAt) {
      errors.push("The link needs both an event name and a time.");
    }
    var steps = params.getAll("step");
    for (var i = 0; i < steps.length; i += 1) {
      if (model.steps.length >= MAX_STEPS) {
        errors.push("Skipped extra steps after 100.");
        break;
      }
      var raw = steps[i];
      var splitAt = raw.indexOf("|");
      if (splitAt === -1) {
        errors.push("Skipped a step that could not be read (" + clip(raw) + ").");
        continue;
      }
      var duration = parseDuration(raw.slice(0, splitAt));
      var name = cleanName(raw.slice(splitAt + 1));
      if (!duration.ok || !name) {
        errors.push("Skipped a step that could not be read (" + clip(raw) + ").");
        continue;
      }
      if (name.length > MAX_NAME) {
        errors.push("Skipped a step with a name over 200 characters.");
        continue;
      }
      model.steps.push({ name: name, minutes: duration.minutes });
    }
    return { model: model, errors: errors };
  }

  function element(doc, tag, options) {
    var node = doc.createElement(tag);
    if (options.className) {
      node.className = options.className;
    }
    if (options.text != null) {
      node.textContent = options.text;
    }
    if (options.attrs) {
      Object.keys(options.attrs).forEach(function (key) {
        var value = options.attrs[key];
        if (value != null && value !== false) {
          node.setAttribute(key, value === true ? "" : String(value));
        }
      });
    }
    return node;
  }

  function mount(doc) {
    if (!doc || typeof doc.getElementById !== "function") {
      return;
    }
    var planner = doc.getElementById("planner");
    if (!planner || planner.getAttribute("data-ready") === "true") {
      return;
    }
    var ids = [
      "planner-form",
      "name-label",
      "event-name",
      "time-label",
      "event-time",
      "time-hint",
      "add-event",
      "change-action",
      "copy-link",
      "start-summary",
      "status",
      "schedule-body",
      "clock",
    ];
    var missing = ids.filter(function (id) {
      return !doc.getElementById(id);
    });
    if (missing.length) {
      var broken = doc.getElementById("status");
      if (broken) {
        broken.textContent = "The planner page is missing a control.";
      }
      return;
    }
    planner.setAttribute("data-ready", "true");

    var form = doc.getElementById("planner-form");
    var nameLabel = doc.getElementById("name-label");
    var nameInput = doc.getElementById("event-name");
    var timeLabel = doc.getElementById("time-label");
    var timeInput = doc.getElementById("event-time");
    var hint = doc.getElementById("time-hint");
    var addButton = doc.getElementById("add-event");
    var changeButton = doc.getElementById("change-action");
    var copyButton = doc.getElementById("copy-link");
    var summary = doc.getElementById("start-summary");
    var status = doc.getElementById("status");
    var tbody = doc.getElementById("schedule-body");
    var clock = doc.getElementById("clock");
    var loaded = modelFromQuery(doc.location ? doc.location.search : "");
    var model = loaded.model;

    function setStatus(message, kind) {
      status.textContent = message || "";
      if (!message) {
        status.className = "";
        return;
      }
      status.className = kind === "error" ? "alert alert-warning" : "alert alert-info";
    }

    function clearInvalid() {
      nameInput.removeAttribute("aria-invalid");
      timeInput.removeAttribute("aria-invalid");
    }

    function showResult(result) {
      clearInvalid();
      setStatus(result.message, result.ok ? "info" : "error");
      if (!result.ok && result.field) {
        var input = result.field === "name" ? nameInput : timeInput;
        input.setAttribute("aria-invalid", "true");
        input.focus();
      }
    }

    function syncUrl() {
      if (!doc.location || !doc.defaultView || !doc.defaultView.history) {
        return;
      }
      try {
        var params = modelToQuery(model);
        var search = params ? "?" + params : "";
        if (doc.location.search === search) {
          return;
        }
        doc.defaultView.history.replaceState(
          null,
          "",
          doc.location.pathname + search + doc.location.hash
        );
      } catch (error) {
        // Some browsers block history updates on file:// pages. The plan still works.
      }
    }

    function applyChrome() {
      var copy = promptCopy(model);
      nameLabel.textContent = copy.nameLabel;
      timeLabel.textContent = copy.timeLabel;
      hint.textContent = copy.hint;
      addButton.textContent = copy.button;
      nameInput.placeholder = copy.namePlaceholder;
      timeInput.placeholder = copy.timePlaceholder;
      timeInput.inputMode = copy.inputMode;
      changeButton.textContent = "Row action: " + ACTION_LABELS[model.action];
      changeButton.setAttribute(
        "aria-label",
        "Change row action. Current action is " + ACTION_LABELS[model.action] + "."
      );
      summary.textContent = startSummary(model);
      doc.title = model.eventName ? model.eventName + " \u2014 Itinerary" : "Itinerary";
    }

    function render() {
      applyChrome();
      tbody.replaceChildren();
      var rows = buildRows(model);
      if (rows.length === 0) {
        var emptyRow = doc.createElement("tr");
        var emptyCell = element(doc, "td", {
          text: "No event yet. Add an event to see when to start.",
          attrs: { colspan: "3", "data-testid": "schedule-empty" },
        });
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
      }
      rows.forEach(function (row) {
        var tr = element(doc, "tr", {
          attrs: { "data-testid": "schedule-row-" + row.index },
        });
        var nameCell = element(doc, "th", {
          text: row.name,
          attrs: { scope: "row" },
        });
        if (row.kind === "step") {
          nameCell.appendChild(
            element(doc, "div", {
              className: "text-muted",
              text: durationLabel(row.duration),
            })
          );
        }
        var timeCell = element(doc, "td", { text: row.startLabel });
        var actionCell = doc.createElement("td");
        var control = rowControl(model, row);
        if (control.textOnly) {
          actionCell.appendChild(
            element(doc, "span", {
              text: control.label,
              attrs: { "data-testid": "row-note-" + row.index },
            })
          );
        } else {
          var button = element(doc, "button", {
            className: control.label === "Remove" ? "btn btn-danger btn-sm" : "btn btn-default btn-sm",
            text: control.label,
            attrs: {
              type: "button",
              id: "row-action-" + row.index,
              "data-testid": "row-action-" + row.index,
              "aria-label": control.label + " " + row.name,
            },
          });
          if (control.disabled) {
            button.disabled = true;
          } else {
            button.addEventListener("click", function () {
              onRowClick(row.index);
            });
          }
          actionCell.appendChild(button);
        }
        tr.appendChild(nameCell);
        tr.appendChild(timeCell);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
      });
    }

    function focusRow(index) {
      if (index == null) {
        return;
      }
      var button = doc.getElementById("row-action-" + index);
      if (button) {
        button.focus();
      }
    }

    function onRowClick(index) {
      var action = model.action;
      var result = applyAction(model, index);
      if (!result.ok) {
        showResult(result);
        return;
      }
      render();
      syncUrl();
      showResult(result);
      if (action === "down") {
        focusRow(index + 1);
      } else if (action === "up") {
        focusRow(index - 1);
      } else if (model.eventMinutes == null && model.steps.length === 0) {
        nameInput.focus();
      } else if (index < model.steps.length || model.eventMinutes != null) {
        focusRow(Math.min(index, model.steps.length));
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var result = addEntry(model, nameInput.value, timeInput.value);
      if (!result.ok) {
        showResult(result);
        return;
      }
      nameInput.value = "";
      timeInput.value = "";
      render();
      syncUrl();
      showResult(result);
      nameInput.focus();
    });

    changeButton.addEventListener("click", function () {
      cycleAction(model);
      render();
      setStatus("Row action is now " + ACTION_LABELS[model.action] + ".", "info");
    });

    copyButton.addEventListener("click", function () {
      var url = doc.location ? doc.location.href : "";
      var clipboard =
        doc.defaultView &&
        doc.defaultView.navigator &&
        doc.defaultView.navigator.clipboard;
      if (clipboard && clipboard.writeText) {
        clipboard.writeText(url).then(
          function () {
            setStatus("Copied the link to this itinerary.", "info");
          },
          function () {
            setStatus("Copy this link: " + url, "info");
          }
        );
        return;
      }
      setStatus("Copy this link: " + url, "info");
    });

    var tick = function () {
      var now = new Date();
      clock.textContent = formatNow(now);
      clock.setAttribute("datetime", now.toISOString());
    };
    tick();
    doc.defaultView.setInterval(tick, 1000);

    render();
    if (doc.location && doc.location.search && doc.location.search !== "?") {
      var suffix = loaded.errors.length ? " " + loaded.errors.join(" ") : "";
      setStatus(
        "Loaded this itinerary from the link." + suffix,
        loaded.errors.length ? "error" : "info"
      );
      syncUrl();
    } else {
      setStatus("Add your event to begin.", "info");
    }
  }

  return {
    ACTIONS: ACTIONS,
    ACTION_LABELS: ACTION_LABELS,
    emptyModel: emptyModel,
    parseEventTime: parseEventTime,
    parseDuration: parseDuration,
    formatClock: formatClock,
    formatNow: formatNow,
    durationLabel: durationLabel,
    promptCopy: promptCopy,
    startSummary: startSummary,
    buildRows: buildRows,
    rowControl: rowControl,
    addEntry: addEntry,
    applyAction: applyAction,
    cycleAction: cycleAction,
    modelToQuery: modelToQuery,
    modelFromQuery: modelFromQuery,
    mount: mount,
  };
});
