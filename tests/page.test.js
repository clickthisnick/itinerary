const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const root = path.join(__dirname, "..");

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

describe("planner page", function () {
  const html = read("itinerary.html");
  const script = read("itinerary.js");
  const home = read("index.html");
  const notes = read("llms.txt");
  const readme = read("README.md");
  const workflow = read(".github/workflows/ci.yml");

  it("has one document outline and the controls agents need", function () {
    for (const tag of ["<html", "</html>", "<head>", "</head>", "<body>", "</body>"]) {
      assert.equal(html.split(tag).length - 1, 1, tag);
    }
    for (const id of [
      "planner",
      "planner-form",
      "name-label",
      "event-name",
      "time-label",
      "event-time",
      "add-event",
      "change-action",
      "copy-link",
      "start-summary",
      "status",
      "schedule",
      "clock",
      "page-title",
    ]) {
      assert.match(html, new RegExp('id="' + id + '"'));
    }
    assert.match(html, /<title>Itinerary<\/title>/);
    assert.match(html, /<h1[^>]*>Itinerary<\/h1>/);
    assert.match(html, /<label[^>]+for="event-name"/);
    assert.match(html, /<label[^>]+for="event-time"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /<script src="itinerary.js"><\/script>/);
    assert.doesNotMatch(html, /onclick=/);
    assert.equal((html.match(/<form/g) || []).length, 1);
  });

  it("keeps untrusted names out of HTML strings", function () {
    assert.doesNotMatch(script, /innerHTML/);
    assert.doesNotMatch(script, /alert\(/);
    assert.doesNotMatch(script, /ko\.observable/);
    assert.doesNotMatch(script, /moment\(/);
    assert.match(script, /textContent/);
  });

  it("links the home page to the planner", function () {
    assert.match(home, /href="itinerary.html"/);
    assert.match(home, /<h1>Itinerary<\/h1>/);
    assert.match(home, /id="open-planner"/);
    assert.doesNotMatch(home, /# README/);
  });

  it("documents how to run the app and how an agent should use it", function () {
    assert.match(readme, /itinerary\.html/);
    assert.match(readme, /node --test/);
    assert.match(readme, /npm start/);
    assert.match(readme, /scripts\/serve\.js/);
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.scripts.start, "node scripts/serve.js");
    assert.match(notes, /#event-name/);
    assert.match(notes, /#add-event/);
    assert.match(notes, /#schedule/);
    assert.match(notes, /#status/);
    assert.match(notes, /#copy-link/);
    assert.match(notes, /minutes\|name/);
  });

  it("runs tests on push and pull request", function () {
    assert.match(workflow, /push:/);
    assert.match(workflow, /pull_request:/);
    assert.match(workflow, /node --test/);
    assert.match(workflow, /actions\/checkout@v5/);
    assert.match(workflow, /actions\/setup-node@v5/);
  });

  it("drops Python hooks that do not apply to this site", function () {
    const hooks = read(".pre-commit-config.yaml");
    assert.match(hooks, /rev: v6\.0\.0/);
    for (const gone of ["pylint", "mypy", "black", "file-contents-sorter", "codespell"]) {
      assert.doesNotMatch(hooks, new RegExp(gone));
    }
  });
});
