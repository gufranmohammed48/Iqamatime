# Building Iqama Time for iPhone (on your Mac)

You need: a Mac with Xcode, and an Apple Developer Program membership ($99/year).
Everything below happens on the Mac. The app code is already prepared.

## 1. One-time Mac setup
1. Install **Xcode** from the Mac App Store. Open it once and accept the license; let it install extra components.
2. Install **Node.js (LTS)** from https://nodejs.org.
3. Open **Terminal** and get the code:
   ```bash
   git clone https://github.com/gufranmohammed48/Iqamatime.git
   cd Iqamatime
   npm install
   npm run sync
   npx cap open ios
   ```
   Xcode opens the project. The first open downloads the Capacitor packages, so keep the internet on and wait for "Resolving packages" to finish.

## 2. Sign the app
In Xcode: click **App** (blue icon, top of the left list) → target **App** → **Signing & Capabilities**:
- Tick **Automatically manage signing**.
- **Team**: choose your Apple Developer team (appears after your membership is approved and you sign in under *Xcode → Settings → Accounts*).
- **Bundle Identifier** must be `com.mohammed.iqamatime`.

## 3. Try it in the simulator
Pick an iPhone (for example an iPhone Pro Max) at the top and press **Run** (the play button). Check: the masjid list, the times, Settings, and "Test my reminder".
Notifications and the 9-second adhan sound also play in the simulator, but do a final check on a real iPhone via TestFlight.

## 4. Screenshots for the App Store
With a Pro Max simulator running, use **File → Save Screenshot** (or Cmd+S). Take 4 to 6: home, masjid list, Settings, prayer options, week table.

## 5. Upload the build
1. At the top, choose **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. In the Organizer window: **Distribute App → App Store Connect → Upload**.

## 6. App Store Connect (appstoreconnect.apple.com)
- **My Apps → +  → New App**: name *Iqama Time*, bundle ID `com.mohammed.iqamatime`, any SKU (e.g. `iqamatime1`).
- Fill in: description, keywords, support URL, **privacy policy URL** `https://gufranmohammed48.github.io/Iqamatime/privacy.html`, category *Lifestyle*.
- **App Privacy**: "Data Not Collected".
- **Age rating**: answer No to everything.
- **Export compliance**: already answered in the app (standard HTTPS only).
- **Review notes**: "No login needed. Choose a masjid from the list, then use Settings to set prayer reminders. Reminders are scheduled on the device as local notifications."
- Select the uploaded build, then **Submit for Review**.

## 7. TestFlight (testing on a real iPhone)
After the upload finishes processing (about 10-30 minutes), the build appears under **TestFlight** in App Store Connect. Add yourself as an internal tester, install the **TestFlight** app on an iPhone, and accept the invite.

## Notes
- iPhones allow only 64 scheduled notifications, so the app schedules the nearest 60 (about 12 days) and refreshes the list every time it is opened.
- To update later: change the code, `git pull`, `npm run sync`, raise the **Build** number in Xcode (General tab), archive and upload again.
