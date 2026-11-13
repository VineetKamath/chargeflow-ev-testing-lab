# ChargeFlow - EV Testing Lab

An interactive, browser-based testing lab for a **Smart EV Charging Reservation System**. It shows how one application is tested at three levels:

- **Katalon Studio**: UI automation of the running app
- **JUnit 5** (with JaCoCo coverage): unit tests for the business rules
- **PIT**: mutation testing, which checks whether those tests are strong enough

Software Testing AAT: Manoj Kumar N (1BM23AD032) and Vineet Kamath (1BM23AD069), guided by Dr. Lakshmishree K P, B.M.S. College of Engineering.

## Pages

| Page | File | What you can do |
| --- | --- | --- |
| Overview | `dist/index.html` | Try the working app, see the three testing layers and all 12 test cases |
| Live Architecture | `dist/architecture.html` | Watch an animated CI/CD pipeline: GitHub Actions → Gradle/JUnit/JaCoCo → PIT internals → Docker staging → Katalon Runtime Engine → quality gate. Four scenarios, presenter mode, and the real command for each component |
| Test Runner | `dist/runner.html` | Run 12 test cases through Katalon UI → JUnit 5 → PIT, with speed control, step-by-step mode, defect injection and a JUnit XML export |
| Katalon Lab | `dist/katalon.html` | Record a test by using the app, add checkpoints, inspect the Object Repository, play the test back, run it against a data file, and demo self-healing after a UI change |
| PIT Lab | `dist/pit.html` | Real mutation testing on six rules: DEFAULTS and STRONGER mutators, kill matrix, mutation score against an 80% threshold, and automatic suggestions for the test that kills each survivor |

## The 12 test cases

| ID | Test case | Technique |
| --- | --- | --- |
| TC01 | Reserve an available slot | Positive · equivalence class |
| TC02 | Reject an occupied charger | Negative |
| TC03 | Battery priority at exactly 20% | Boundary value analysis |
| TC04 | Battery 21% gets normal priority | Boundary value analysis |
| TC05 | Peak tariff at exactly 80% load | Boundary value · API + UI |
| TC06 | Off-peak tariff at 79% load | Boundary value · API + UI |
| TC07 | Reject battery level 101% | Negative · invalid partition |
| TC08 | Accept battery level 0% | Boundary value (lower edge) |
| TC09 | Reject a 135-minute session | Negative · boundary |
| TC10 | Prevent a double booking | State-based |
| TC11 | Reject an offline charger | Negative |
| TC12 | Cancelling a booking frees the slot | State transition |

## Run locally

No build step and no dependencies.

1. Clone the repository.
2. Open `dist/index.html` in any modern browser.

If your browser restricts local files, serve the folder instead:

~~~bash
npx serve dist
~~~

## What is real and what is simulated

- **Real:** the ChargeFlow mock app and its rules; the JUnit-style assertions; mutant generation, compilation and execution in the PIT Lab and the Test Runner; the Katalon-style recorder, playback and self-healing (they drive the real DOM of the mock app).
- **Simulated:** the Kotlin backend (ported to JavaScript), the CI pipeline timing and infrastructure in the Live Architecture page, and the Katalon/PIT tools themselves (their behaviour, keywords and report formats are reproduced). The commands and configuration shown are the real ones you would use with Gradle, PIT, Katalon Runtime Engine and GitHub Actions.

## Structure

~~~text
dist/
  index.html          overview
  architecture.html   live CI/CD diagram
  runner.html         12-case test runner
  katalon.html        recorder / playback / self-healing lab
  pit.html            mutation testing lab
  assets/
    style.css         shared design system
    rules.js          ChargeFlow rules, defects, mutation engine, default JUnit suite
    phone.js          mock mobile app + Katalon-style WebUI driver
    cases.js          the 12 test cases
presentation/         AAT slide deck (.pptx)
~~~
