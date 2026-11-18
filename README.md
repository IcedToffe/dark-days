# Dark Days (Brain Lies)

A small, private web app for people with depression and suicidal thoughts. It keeps your own proof, your safety plan and calming tools in one place, for the days your brain lies.

No server, no accounts, no tracking. Everything is saved in the browser on your own device.

## Features
- Rough day: severity check (1-10). High scores show crisis help and the safety plan first.
- Proof: save notes, photos and voice clips. They come back on a rough day, matched to the belief you pick.
- Voices: friends write you a note through a link and send back a code.
- Safety plan: based on the Stanley-Brown Safety Planning Intervention.
- Trusted contacts: Text, Call, or Messenger with a prefilled message.
- Reasons to stay.
- Crisis help: always-visible button, hotlines by country, "I'm in immediate danger" screen.
- Calm: guided breathing (respects reduced motion), 5-4-3-2-1 grounding, 15-minute wait timer, rain and ocean sounds, gentle distractions.

## Files
- `index.html`: the app
- `style.css`: styles
- `app.js`: all the logic
- `write.html`: the page friends open to write you a note

## Run it locally
Open the folder in VS Code, install the "Live Server" extension, right-click `index.html` and choose "Open with Live Server". Or run `python3 -m http.server 8000` in the folder and visit http://localhost:8000.

## Put it on GitHub and host it free
```
cd dark-days
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/dark-days.git
git push -u origin main
```
Then on GitHub: Settings > Pages > Deploy from a branch > `main` / `(root)` > Save. Your app will be at `https://YOUR-USERNAME.github.io/dark-days/`. Send that link (the "Copy link to send" button builds the note link for you).

## Important before sharing with others
- Verify every hotline number in the `C` object in `app.js`. Numbers change.
- Ask a mental health professional to review the wording.
- This app supports people; it does not replace professional care.

## Privacy
Notes, photos, voice clips, the safety plan, contacts and reasons are stored only in your browser (IndexedDB and localStorage). Clearing browser data erases them. The friend code is encoded, not encrypted.
