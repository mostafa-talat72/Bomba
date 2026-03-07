# Bugfix Requirements Document

## Introduction

The email sending functionality in the Bomba system is failing when attempting to send daily reports via email. The error "nodemailer.createTransporter is not a function" occurs during the transporter creation process, preventing any emails from being sent. This affects critical business operations including daily reports, low stock alerts, and user account notifications.

The root cause is an incorrect dynamic import pattern for the nodemailer library in an ES Modules environment. While the import statement executes without errors, the resulting object structure doesn't expose the `createTransport` method as expected, causing runtime failures when attempting to create email transporters.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the email.js module is loaded with `nodemailer = await import("nodemailer")` THEN the system imports nodemailer but the resulting object structure does not expose the `createTransport` method correctly

1.2 WHEN createTransporter() function attempts to call `nodemailer.createTransport()` THEN the system throws "nodemailer.createTransporter is not a function" error

1.3 WHEN sendDailyReport() is called with valid report data and admin emails THEN the system generates the PDF successfully but fails to send the email due to the transporter creation error

1.4 WHEN the fallback logic in sendEmail() tries to use `nodemailer.createTransport()` THEN the system encounters the same "not a function" error and cannot recover

### Expected Behavior (Correct)

2.1 WHEN the email.js module is loaded THEN the system SHALL import nodemailer correctly and expose the `createTransport` method as a callable function

2.2 WHEN createTransporter() function calls the nodemailer import THEN the system SHALL successfully create an email transporter without throwing errors

2.3 WHEN sendDailyReport() is called with valid report data and admin emails THEN the system SHALL generate the PDF and successfully send the email with the PDF attachment to all admin recipients

2.4 WHEN the fallback logic in sendEmail() is triggered THEN the system SHALL successfully create a fallback transporter and send the email

### Unchanged Behavior (Regression Prevention)

3.1 WHEN email configuration environment variables are missing THEN the system SHALL CONTINUE TO log warnings and return null from createTransporter() without attempting to send emails

3.2 WHEN email templates are generated (lowStockAlert, dailyReport, monthlyReport, userCreated) THEN the system SHALL CONTINUE TO generate correct HTML content with proper language and currency formatting

3.3 WHEN sendLowStockAlert() is called with valid parameters THEN the system SHALL CONTINUE TO send alerts to multiple recipients and return success/failure results for each

3.4 WHEN sendMonthlyReport() is called with valid parameters THEN the system SHALL CONTINUE TO send monthly reports using the correct email template

3.5 WHEN Logger methods are called throughout the email sending process THEN the system SHALL CONTINUE TO log appropriate info, warn, and error messages with context data

3.6 WHEN PDF generation is triggered for daily reports THEN the system SHALL CONTINUE TO generate valid PDF buffers with correct report data
