# Iqama Time – publishing the iPhone app

Assalamu alaikum, and JazakAllahu khayran for publishing Iqama Time on your Apple developer account.

Iqama Time shows iqamah times for South Florida masjids, counts down to the next prayer and reminds people before iqamah. It is already on Google Play for Android (closed testing). This folder has everything needed for the App Store.

## What is in this folder

| File | What it is |
|---|---|
| `START-HERE.md` | This page: the steps, start to finish |
| `appstore-listing.md` | All the App Store Connect text to copy and paste (name, subtitle, keywords, description, URLs, review notes, questionnaire answers) |
| `app-icon-1024.png` | The App Store icon (1024 x 1024). It is also already inside the Xcode project |
| `iphone-screenshots/` | **Ready-to-upload App Store screenshots**, 1320 x 2868 (the 6.9-inch iPhone size Apple asks for): today's times, week table, choosing a masjid, Settings, prayer reminders, dark mode |
| `android-screenshots/` | Screenshots from the Android version, for reference only |

## Facts you will need

- **App name:** Iqama Time
- **Bundle ID:** `com.mohammed.iqamatime` (already set in the Xcode project)
- **Version:** 1.1, build 1
- **Source code:** https://github.com/gufranmohammed48/Iqamatime (public)
- **Privacy policy:** https://gufranmohammed48.github.io/Iqamatime/privacy.html
- **Support / marketing URL:** https://gufranmohammed48.github.io/Iqamatime/
- **Support email (shown to users):** 104tutorials104@gmail.com
- **Price:** Free. No ads, no in-app purchases, no accounts, no data collected.
- **Devices:** iPhone only (no iPad screenshots needed)

## What you need

- A Mac with **Xcode** (from the Mac App Store; open it once to finish installing)
- **Node.js LTS** from https://nodejs.org
- Your **Apple Developer Program** membership, signed in under Xcode → Settings → Accounts

## Steps

### 1. Get the code and open it in Xcode
In Terminal:
```bash
git clone https://github.com/gufranmohammed48/Iqamatime.git
cd Iqamatime
npm install
npm run sync
npx cap open ios
```
Xcode opens. The first time it downloads packages ("Resolving packages"); keep the internet on and wait.

### 2. Sign with your team
Click **App** (blue icon at the top left) → target **App** → **Signing & Capabilities**:
- Tick **Automatically manage signing**
- **Team:** your team
- **Bundle Identifier:** `com.mohammed.iqamatime` (leave as is)

### 3. Test it
Choose an iPhone Pro Max simulator at the top and press **Run** (▶). Check: pick a masjid, the times show, swipe the week table, Settings → "Test my reminder".

### 4. Screenshots
Already done: upload the 6 images from `iphone-screenshots/` in App Store Connect (6.9-inch iPhone display). If you prefer your own, use the iPhone Pro Max simulator and press **Cmd+S**.

### 5. Create the app in App Store Connect
https://appstoreconnect.apple.com → **My Apps → + → New App**
- Platform iOS, name **Iqama Time**, language English (U.S.)
- Bundle ID `com.mohammed.iqamatime`, SKU anything (for example `iqamatime1`)

Then paste everything from **`appstore-listing.md`**: subtitle, promotional text, keywords, description, URLs, category (Lifestyle), age rating (all No → 4+), App Privacy (**Data Not Collected**), review notes. Upload the icon if asked and the screenshots from `iphone-screenshots/`.

### 6. Upload the build
In Xcode: choose **Any iOS Device (arm64)** at the top → **Product → Archive** → in the Organizer window **Distribute App → App Store Connect → Upload**.
After 10–30 minutes the build appears in App Store Connect.

### 7. TestFlight, then submit
- **TestFlight:** add yourself (and Gufran if you like) as internal testers and try it on a real iPhone, especially the notifications.
- On the version page, pick the uploaded build and **Submit for Review**.

## Good to know

- **Masjid times update by themselves.** Masjids and their schedules are loaded from the website, so adding a masjid or changing times never needs a new App Store version.
- **App updates** (new features) need a new build: `git pull`, `npm run sync`, raise the **Build** number in Xcode (General tab), Archive and upload again. Gufran will tell you when there is a new version.
- **Notifications:** iPhones keep at most 64 scheduled notifications, so the app schedules the nearest ~60 and refreshes them every time it is opened. This is expected.
- **Encryption question:** already answered inside the app (standard HTTPS only), so App Store Connect should not ask.
- **Content rights question:** the adhan recording is a third-party audio file; please confirm with Gufran before answering.
- A cloud Mac build already checks that this project compiles for the iPhone simulator, so it should build cleanly.

Questions: Gufran, 104tutorials104@gmail.com
