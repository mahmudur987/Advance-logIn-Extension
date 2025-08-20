/* eslint-disable no-undef */

// Firebase Configuration (unchanged)
const firebaseConfig = {
  apiKey: "AIzaSyBoLIMyfURR-B2pddcKePXsyP2uMUY8Svk",
  authDomain: "advance-login-helper-extension.firebaseapp.com",
  projectId: "advance-login-helper-extension",
  storageBucket: "advance-login-helper-extension.firebasestorage.app",
  messagingSenderId: "851630006286",
  appId: "1:851630006286:web:f738892ddd600b98e35c5f",
  databaseURL:
    "https://advance-login-helper-extension-default-rtdb.firebaseio.com",
};
// firebase
// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = app.database();

// Global data
let accountsData = {};

// --- Load data from Firebase live and sort by createdAt ---
firebase
  .database()
  .ref("houses")
  .on("value", (snapshot) => {
    const fetchedData = snapshot.val() || {};

    // Convert the object to an array to enable sorting
    const housesArray = Object.entries(fetchedData);

    // Sort the array based on the 'createdAt' timestamp
    housesArray.sort(([, a], [, b]) => {
      const aTime =
        a["Robi PretUps"]?.createdAt ?? a["Airtel PretUps"]?.createdAt ?? 0;
      const bTime =
        b["Robi PretUps"]?.createdAt ?? b["Airtel PretUps"]?.createdAt ?? 0;
      return aTime - bTime;
    });

    // Reconstruct the data into the original object format for your app
    accountsData = Object.fromEntries(housesArray);

    // Call the display functions with the sorted data
    displayAccountsOnStatusBoard(accountsData);
    loadHouses();
  });

// --- Fetch fresh data from Google Sheet ---
async function refreshData() {
  console.log("Refreshing data...");
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcel_HqXnbFwYeQOdzaIL-fO0sY8a5xY2pKszkHrceYqhy-jPPv91qcvjp0VE6hg/pub?output=xlsx";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch Google Sheet data.");
    }
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

    await firebase.database().ref("houses").remove();

    json.forEach((row, index) => {
      const house = row["DB House Name"];
      if (house) {
        const timestamp = Date.now() + index;
        firebase
          .database()
          .ref(`houses/${house}/Robi PretUps`)
          .set({
            id: row["Robi PretUps Login ID"] || "",
            password: row["Robi PretUps Password"] || "",
            status: "pending",
            createdAt: timestamp,
          });
        firebase
          .database()
          .ref(`houses/${house}/Airtel PretUps`)
          .set({
            id: row["Airtel PretUps Login ID"] || "",
            password: row["Airtel PretUps Password"] || "",
            status: "pending",
            createdAt: timestamp,
          });
      }
    });
    console.log("Data refreshed successfully!");
  } catch (error) {
    console.error("Error refreshing data:", error);
  }
}

// --- Populate dropdown ---
function loadHouses() {
  const houseSelect = document.getElementById("houseSelect");
  houseSelect.innerHTML = "";
  if (!accountsData || Object.keys(accountsData).length === 0) {
    houseSelect.innerHTML = "<option>No Data</option>";
    return;
  }
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
  if (
    !house ||
    !accountsData[house] ||
    Object.keys(accountsData[house]).length === 0
  ) {
    accountSelect.innerHTML = "<option>No Accounts</option>";
    return;
  }
  Object.keys(accountsData[house]).forEach((accType) => {
    const acc = accountsData[house][accType];
    const option = document.createElement("option");
    option.value = accType;
    option.textContent = `${accType} (${acc.status})`;
    option.style.backgroundColor =
      acc.status === "done" ? "#d4edda" : "#f8d7da";
    accountSelect.appendChild(option);
  });
  showSelected();
}

// --- Show selected id+password ---
function showSelected() {
  const house = document.getElementById("houseSelect").value;
  const accountType = document.getElementById("accountSelect").value;
  const loginIdDisplay = document.getElementById("loginId");
  const passwordDisplay = document.getElementById("password");

  if (
    !house ||
    !accountType ||
    !accountsData[house] ||
    !accountsData[house][accountType]
  ) {
    loginIdDisplay.textContent = "";
    passwordDisplay.textContent = "";
    return;
  }
  const acc = accountsData[house][accountType];
  loginIdDisplay.textContent = acc.id || "N/A";
  passwordDisplay.textContent = acc.password || "N/A";
}

// --- Auto Fill + Update Status ---
document.getElementById("fillLogin").addEventListener("click", () => {
  const house = document.getElementById("houseSelect").value;
  const accountType = document.getElementById("accountSelect").value;
  const account = accountsData[house][accountType];

  if (!account || !account.id || !account.password) {
    console.error("Account data is incomplete. Cannot fill.");
    return;
  }

  const usernameSelectors = [
    'input[name="username"]',
    'input[name="userName"]',
    'input[id="username"]',
    'input[id="email"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[name="loginId"]',
    'input[name="userId"]',
    "input.username",
    "input.email",
    'input[id*="user"]',
    'input[id*="login"]',
    'input[placeholder*="User"]',
    'input[placeholder*="Login"]',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="number"]',
  ];

  const passwordSelectors = [
    'input[name="password"]',
    'input[id="password"]',
    "input.password",
    'input[type="password"]',
    'input[name="pass"]',
    'input[id*="pass"]',
  ];

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [
        account.id,
        account.password,
        usernameSelectors,
        passwordSelectors,
      ],
      func: (id, password, usernameSelectors, passwordSelectors) => {
        const findAndFill = (selectors, value) => {
          const element = selectors
            .map((sel) => document.querySelector(sel))
            .find((el) => el && el.offsetParent !== null && !el.disabled);
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            element.blur();
            return true;
          }
          return false;
        };
        const usernameFilled = findAndFill(usernameSelectors, id);
        if (usernameFilled) {
          setTimeout(() => {
            findAndFill(passwordSelectors, password);
          }, 200);
        }
      },
    });
  });

  // Mark as "done"
  firebase
    .database()
    .ref(`houses/${house}/${accountType}`)
    .update({ status: "done" });
});

// --- Refresh Button ---
document.getElementById("resetToday").addEventListener("click", refreshData);

// --- Dropdown listeners ---
document.getElementById("houseSelect").addEventListener("change", loadAccounts);
document
  .getElementById("accountSelect")
  .addEventListener("change", showSelected);

// --- Display status board ---
function displayAccountsOnStatusBoard(data) {
  const statusBoard = document.getElementById("statusBoard");
  statusBoard.innerHTML = ""; // Clear existing content

  // Filter for pending accounts for the display board
  const filteredData = Object.fromEntries(
    Object.entries(data)
      .map(([house, accounts]) => {
        const pendingAccounts = Object.fromEntries(
          Object.entries(accounts).filter(([, account]) => {
            return account.status === "pending";
          })
        );
        return [house, pendingAccounts];
      })
      .filter(([, accounts]) => Object.keys(accounts).length > 0)
  );

  // Check if any pending data exists after filtering
  if (Object.keys(filteredData).length === 0) {
    statusBoard.textContent = "All accounts have been processed for today.";
    return;
  }

  // Iterate over each house name and display only pending accounts
  for (const houseName in filteredData) {
    if (Object.prototype.hasOwnProperty.call(filteredData, houseName)) {
      const houseEntry = document.createElement("div");
      houseEntry.className = "house-entry";

      const houseNameElement = document.createElement("div");
      houseNameElement.className = "house-name";
      houseNameElement.textContent = houseName;
      houseEntry.appendChild(houseNameElement);

      const houseAccounts = filteredData[houseName];
      for (const accountType in houseAccounts) {
        if (Object.prototype.hasOwnProperty.call(houseAccounts, accountType)) {
          const account = houseAccounts[accountType];
          const accountInfo = document.createElement("div");
          accountInfo.className = "account-info";
          const statusClass = account.status === "pending" ? "red" : "green";

          accountInfo.innerHTML = `
            <p class="account-type" style="color: ${statusClass}; font-weight: bold;">
              ${accountType}
            </p>
          `;
          houseEntry.appendChild(accountInfo);
        }
      }
      statusBoard.appendChild(houseEntry);
    }
  }
}
console.log("popup.js loaded");
