# NV Ops: putting it online

NV Ops is NV Construction's own copy of the operations app. It runs on its own Netlify site with its own storage, so nothing is shared with Trans Island Logistics.

## First time (about 20 minutes)

1. **GitHub.** Create a new private repository called `nv-ops`. Upload everything in this folder (the `public` and `netlify` folders, `package.json`, `netlify.toml`, and these notes). Commit.
2. **Netlify.** Add new site → Import an existing project → GitHub → choose `nv-ops`. Leave the build settings as they are (they come from `netlify.toml`) and deploy.
3. **Setup code.** In the new site: Site configuration → Environment variables → Add a variable. Name `SETUP_CODE`, value any phrase only you know, scope Functions, Production. Then Deploys → Trigger deploy.
4. **Create the owner account.** Open the site address. The app asks for the setup code, a name, a username and a password (10 characters or more). This first account is the owner.
5. **Fill in NV's details** under Manage → Business Settings: bank name and account number, the real vehicle details, crew names, and prices by area for skip hire. Then add each skip bin under Manage → Skip Bins → Bin register, and set the excavator's service interval under Engine Hours.

## Optional, when NV wants them

- **Email reports and backups:** `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` (a Gmail app password, not the normal password). Use an NV address, not yours.
- **Monthly backup to Google Drive:** `GDRIVE_WEBHOOK_URL` and `GDRIVE_SECRET`, set up the same way as for Trans Island Logistics but with NV's Google account.
- **A custom address** such as `app.nvconstruction784.com`: Domain management in Netlify. Face ID sign-in is tied to the address, so set the final address before staff register Face ID.

`SESSION_SECRET` is optional; without it the app makes and stores its own.

## Bookings from the website, Airbnb and Booking.com

These three steps connect the outside world to the app. Do them once the app is live and the units are set up.

**1. The website.** In the website's `index.html`, find `var APP_URL = '';` and put the app's address between the quotes (this connects both the enquiry form and the Book your stay panel), for example `var APP_URL = 'https://nv-ops.netlify.app';`. Upload the website again. Then, in the **app's** Netlify site, add an environment variable named `SITE_ORIGIN` with the website's address, for example `https://nv-cozy.netlify.app` (no slash at the end), and redeploy the app. Only that website can then send requests into the app. Every enquiry still arrives by email from Netlify Forms as well.

**2. Airbnb, for each unit listed there.**
- In Airbnb: Calendar, then the listing, then Availability, then Connect to another website (sometimes called Sync calendars). Copy the **Export calendar** link.
- In the app: switch to Cozy Apartments, then Manage, then Booking Sites. Paste it into that unit's Airbnb box and tap Save links.
- Still in Booking Sites, tap **Copy for Airbnb** under the unit. Back in Airbnb, choose **Import calendar**, paste it and give it the name NV Ops.

**3. Booking.com, for each unit listed there.**
- In the Booking.com extranet: Rates & Availability, then Sync calendars. Copy the **export** link for the room.
- Paste it into the unit's Booking.com box in Booking Sites and save.
- Tap **Copy for Booking.com** and add it in Booking.com as an **import** link.

The app reads the sites every 30 minutes (tap Sync now to read them straight away). Airbnb and Booking.com read the app's links on their own timetable, usually every few hours, so a direct booking can take a while to close on their calendars. For a booking made in the last hour, check the other sites before confirming a same-day guest.

**What comes through.** The sites share dates through these links, not guest names or prices. Each booking appears with the site's name and the dates (and, from Airbnb, the reservation code and the last four digits of the guest's phone). Its income is estimated from the unit's nightly rate until you enter the payout: Cozy Apartments, Home, Payouts to enter. Set the fee each site keeps under Booking Sites so the estimates are close.

## Paying staff by direct deposit (BOSVG)

Payroll makes a CSV file in the format BOSVG asks for under ECACH EFT. Before the first run:
1. Apply to BOSVG for ECACH EFT (the EFT Application and Agreement form on bosvg.com, under iBank, ECACH EFT).
2. Ask BOSVG for its routing (transit) number and whether they want any changes to the file layout, and enter the number in Manage, Payroll, Bank file settings.
3. Add each person in Payroll with their account number and account type (savings SAV or chequing DDA). People who bank elsewhere need their own bank's routing number.
Each pay run: work it out, check the lines, mark it paid, download the BOSVG file, upload it in BOSVG online banking and approve it there.



Upload the changed `public` and `netlify` folders to the same repository and commit. Wait for Published in Netlify, then close and reopen the app. Records are not affected.
