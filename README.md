# ChargeFlow - Interactive EV Testing Lab

An interactive presentation prototype for a **Smart EV Charging Reservation System**. It visually demonstrates four functional test cases across:

- mobile booking UI
- Katalon Studio UI automation
- Kotlin / JUnit backend validation
- PIT mutation-testing results

## Demonstrated Test Cases

1. Reserve an available charging slot
2. Reject booking for an occupied charger
3. Check low-battery priority at exactly 20%
4. Apply the correct dynamic tariff at exactly 80% load

Each case can be run individually, or all four can be run in sequence. The architecture diagram highlights the active layer during each simulation.

## Run Locally

No dependencies or installation are required.

1. Clone the repository:

~~~bash
git clone https://github.com/YOUR-USERNAME/chargeflow-ev-testing-lab.git
~~~

2. Open the project folder.
3. Open the dist/index.html file in any modern web browser.
4. Click a test case in the left panel, then click **Run this test case**.

For a full presentation sequence, click **Run all 4 test cases**.

## Optional Local Server

If your browser restricts opening local HTML files, run:

~~~bash
npx serve dist
~~~

Then open the local URL shown in the terminal.

## Technology Demonstrated

| Layer | Tool / Technology | Purpose |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript | Interactive visual simulation |
| UI automation | Katalon Studio | UI flows and visible assertions |
| Backend | Kotlin + Spring Boot | Reservation and pricing rules |
| Unit testing | JUnit 5 | Backend-rule validation |
| Mutation testing | PIT + Kotlin support | Test-suite effectiveness |

## Important Note

This repository is a presentation prototype. The Katalon, JUnit, and PIT outputs shown in the interface are simulated to explain the testing workflow clearly. A production implementation can connect these panels to real test-run reports.

## Author

Vineet R Kamath
