// Shared between the client (which renders the field) and the server (which
// rejects submissions that fill it). The name looks like a field bots expect
// on a form, such as a website URL box.
export const HONEYPOT_FIELD = "website_url";
// Under a second from page load to submit is not something a person types.
export const MIN_FORM_SECONDS = 2;
