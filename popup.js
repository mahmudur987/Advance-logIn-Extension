/* eslint-disable no-undef */
import {
  getDatabase,
  ref,
  onValue,
  remove,
  set,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBoLIMyfURR-B2pddcKePXsyP2uMUY8Svk",
  authDomain: "advance-login-helper-extension.firebaseapp.com",
  projectId: "advance-login-helper-extension",
  storageBucket: "advance-login-helper-extension.firebasestorage.app",
  messagingSenderId: "851630006286",
  appId: "1:851630006286:web:f738892ddd600b98e35c5f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global data

let accountsData = {};

// --- Load from Firebase live ---
onValue(ref(db, "houses"), (snapshot) => {
  accountsData = snapshot.val() || {};
  loadHouses();
});

// --- Fetch fresh data from Google Sheet ---
async function refreshData() {
  console.log("Refreshing data...");
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcel_HqXnbFwYeQOdzaIL-fO0sY8a5xY2pKszkHrceYqhy-jPPv91qcvjp0VE6hg/pub?output=xlsx";

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.SheetNames[0];
  const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

  // Clear old data
  await remove(ref(db, "houses"));

  // Insert new with default "pending"
  json.forEach((row) => {
    const house = row["DB House Name"];
    set(ref(db, `houses/${house}/Robi PretUps`), {
      id: row["Robi PretUps Login ID"],
      password: row["Robi PretUps Password"],
      status: "pending",
    });
    set(ref(db, `houses/${house}/Airtel PretUps`), {
      id: row["Airtel PretUps Login ID"],
      password: row["Airtel PretUps Password"],
      status: "pending",
    });
  });
}
// --- Populate dropdown ---
function loadHouses() {
  const houseSelect = document.getElementById("houseSelect");
  const accountSelect = document.getElementById("accountSelect");

  houseSelect.innerHTML = "";
  accountSelect.innerHTML = "";
  console.log("popup.js loaded", accountsData);

  Object.keys(accountsData).forEach((house) => {
    const option = document.createElement("option");
    option.value = house;
    option.textContent = house;
    houseSelect.appendChild(option);
  });

  loadAccounts();
}

// --- Load account types ---
function loadAccounts() {
  const house = document.getElementById("houseSelect").value;
  const accountSelect = document.getElementById("accountSelect");
  accountSelect.innerHTML = "";

  if (!house || !accountsData[house]) return;

  Object.keys(accountsData[house]).forEach((accType) => {
    const acc = accountsData[house][accType];
    const option = document.createElement("option");
    option.value = accType;
    option.textContent = `${accType} (${acc.status})`;
    option.style.backgroundColor =
      acc.status === "done" ? "#d4edda" : "#f8d7da"; // green/red
    accountSelect.appendChild(option);
  });

  showSelected();
}

// --- Show selected id+password ---
function showSelected() {
  const house = document.getElementById("houseSelect").value;
  const accountType = document.getElementById("accountSelect").value;

  if (!house || !accountType) return;

  const acc = accountsData[house][accountType];
  document.getElementById("loginId").textContent = acc.id;
  document.getElementById("password").textContent = acc.password;
}

// --- Auto Fill + Update Status ---
document.getElementById("fillLogin").addEventListener("click", () => {
  const house = document.getElementById("houseSelect").value;
  const accountType = document.getElementById("accountSelect").value;
  const account = accountsData[house][accountType];

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (id, password) => {
        document.querySelector(
          'input[name="username"], input[type="text"]'
        ).value = id;
        document.querySelector(
          'input[name="password"], input[type="password"]'
        ).value = password;
      },
      args: [account.id, account.password],
    });
  });

  // Mark as "done"
  update(ref(db, `houses/${house}/${accountType}`), { status: "done" });
});

// --- Refresh Button ---
document.getElementById("resetToday").addEventListener("click", refreshData);

// --- Dropdown listeners ---
document.getElementById("houseSelect").addEventListener("change", loadAccounts);
document
  .getElementById("accountSelect")
  .addEventListener("change", showSelected);

console.log("popup.js loaded");
