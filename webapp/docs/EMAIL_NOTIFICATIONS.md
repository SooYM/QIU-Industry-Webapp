# Employer approval email

The portal writes one immutable document to the `mail` collection when:

- an employer registration is approved; or
- an employer vacancy is approved for the first time.

Registration approval, exhibitor publication, access grant, and its email queue
write are committed in one Firestore batch. Vacancy approval and its email queue
write are also committed together. Deterministic document IDs prevent repeat
button clicks from sending duplicate approval messages.

## Enable delivery

Firebase Hosting cannot send email itself. Install Firebase's official Trigger
Email extension and connect it to an SMTP delivery account:

```bash
firebase ext:install firebase/firestore-send-email --project industryday-2026
```

During installation, configure:

- Email documents collection: `mail`
- SMTP connection URI and credentials from the chosen mail provider
- A verified QIU sender address
- QIU organiser reply-to address

Provider credentials belong in the extension's secret configuration. Never put
them in `NEXT_PUBLIC_*`, `.env.local`, browser code, or Firestore.

Install and verify the extension before approving real registrations. Trigger
Email reacts to newly created documents; approval documents created before the
extension is active will not automatically replay.

Official setup and delivery-status references:

- https://firebase.google.com/docs/extensions/official/firestore-send-email
- https://firebase.google.com/docs/extensions/official/firestore-send-email/delivery-status

Firestore rules allow admins to create bounded plain-text approval messages and
read delivery status. Client updates and deletes are denied; the extension uses
privileged server credentials to add its `delivery` status.
