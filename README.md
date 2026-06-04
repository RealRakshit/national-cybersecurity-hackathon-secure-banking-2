# MERN Secure Banking Demo

This project is a MERN banking demo with webcam face descriptor matching, password verification, CAPTCHA challenges, cookie-backed idle sessions, and payment review queue controls.

## Structure

- `backend/` - Express server, MongoDB connection, face descriptor storage, session and banking endpoints.
- `frontend/` - React + Vite UI, webcam face capture, banking dashboard, transfer drawing challenge.
- `ml/` - Python typing-behavior training notebook, predictor, and exported model artifact.

## Setup

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

3. Configure backend environment:
   - Copy `backend/.env.example` to `backend/.env`.
   - Set `MONGO_URI` to your MongoDB connection string.
   - Set `CLIENT_ORIGIN` when the frontend is not at `http://localhost:5173`.
   - Set `TRUST_PROXY=true` only behind a reverse proxy that overwrites forwarding headers.

4. Start MongoDB locally or with your cloud database.

5. Install the typing-behavior Python dependencies and export the pickle model:
   ```bash
   cd ml
   python -m pip install -r requirements.txt
   python train_typing_model.py
   ```
   The backend uses `python` by default when it calls the predictor. Set `PYTHON_BIN` for the backend if a different Python executable should run `ml/predict_typing_behavior.py`.

## Run

- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`

The frontend is configured to proxy `/api` requests to `http://localhost:5000`.

## Security Notes

- New accounts start with a zero balance. Funds should be added by a database/admin flow before posted transfers can debit the account.
- Posted payments use a MongoDB multi-document transaction. Use a MongoDB deployment that supports transactions.
- Payments above 10000, or payments that push the sender's last-hour outflow above 10000, enter the review queue and do not change balances yet.
- To approve a queued payment from MongoDB, update its transaction `status` from `queued` to `approved`. The backend settlement worker sees approved rows and atomically changes balances before setting the transaction to `posted`.
- Approved payment records must keep their original `sender`, `recipient`, and integer `amountCents` fields. Legacy rows with only `user`, `type`, and `amount` are not payment-transfer queue records and are ignored by settlement.
- If settlement writes `settlementError`, fix the payment-transfer record and clear `settlementError` before retrying.
- Do not set a queued transaction directly to `posted` in MongoDB. That skips the debit and credit operation.
- Sessions expire after one minute of idle time in the frontend and backend.
- The frontend loads face-api.js models from a CDN and captures face descriptors directly from the webcam.
- Login collects aggregate password typing metrics only: WPM, average key hold time, average delay between keys, and backspace count.
- MongoDB keeps each user's last five accepted login typing profiles. Once five profiles exist, the exported Python model checks the next login against that user's recent baseline before a session is created.
- Suspicious typing samples are not added to the user's baseline, and login is blocked before a session cookie is issued.
- Training prints accuracy, precision, recall, and F1 from a labeled synthetic held-out evaluation set. The predictor prints those saved synthetic metrics again when it runs; a single live login cannot provide classification metrics without a ground-truth suspicious/normal label.
- A browser app cannot reliably inspect desktop background processes such as remote-control tools.
-IP bounding and Browser bounding
-Automatic session expiry after 1 minute
-secured inputs
-ML model for wpm during login-isolation forest
-camera face dtection by faceapi.js
-captcha during login
-and drawng capcha during transaction
-queing of payment above 10000 or above 10000 cumulative transaction per hour
-remote access flag manual rn



mongodb-rakereddit@gmail.com
