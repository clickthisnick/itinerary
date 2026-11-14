# Itinerary

Find yourself always late to the big event?

Itinerary works backward from the time you need to be somewhere. Add the event, then add each step you take beforehand (brush teeth, travel) and how many minutes it takes. The page shows when to start each step, including the moment you need to start getting ready.

Live app: <https://www.clickthisnick.com/itinerary/itinerary.html>

## Run it locally

The site is the HTML, CSS, and JavaScript in this folder. Opening the files is enough. There is no build step.

- Open `itinerary.html` in a browser, or
- From this folder, run `python3 -m http.server 8080` and visit <http://localhost:8080/itinerary.html>

A copied link opens the same plan. The page keeps the event and steps in the query string (`event`, `at`, and one `step` value per step, written as `minutes|name`).

## How the schedule is calculated

Steps stay in the order you will do them. The last step ends when the event starts, and each earlier step is placed before that. Move up and Move down reorder those steps. Noon is 12:00 PM and midnight is 12:00 AM. When the prep time crosses midnight, the start time says it is on the previous day.

Accepted event times include `7:00 PM`, `7pm`, and `19:00`. Step lengths are whole minutes, such as `15` or `15 minutes`.

## Tests

Requires Node.js 20 or newer.

```bash
node --test
```

`npm test` runs the same checks. GitHub Actions runs them on every push and pull request.

Notes for browser agents are in [llms.txt](llms.txt).

## License

This project is licensed under the [Apache 2.0](LICENSE) license.
