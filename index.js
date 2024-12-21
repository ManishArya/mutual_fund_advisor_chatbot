const express = require("express");
const { WebhookClient, Payload } = require("dialogflow-fulfillment");
const bodyParser = require("body-parser");
const app = express().use(bodyParser.json());
let userMobileNumber = undefined;

//#region  Intent Handler Mapper
function mapIntentHandler() {
  const intentMap = new Map();
  intentMap.set("Default Welcome Intent", defaultWelcomeIntentHandler);
  intentMap.set("Portfolio Valuation Intent", portfolioValuationIntentHandler);
  intentMap.set("Show Valuations Intent", showValuationIntentHandler);
  intentMap.set("Transaction History Intent", transactionHistoryIntentHandler);
  intentMap.set("Date Validations Intent", dateValidationsIntentHandler);
  intentMap.set("Yes Invest Intent", yesInvestIntentHandler);
  intentMap.set("No Invest Intent", noInvestIntentHandler);
  intentMap.set("Date Options Intent", dateOptionsIntentHandler);
  intentMap.set("Enter Date Intent", enterDateIntentHandler);
  intentMap.set("Fund Explorer Intent", fundExplorerIntentHandler);
  intentMap.set("Select Fund Option Intent", selectFundOptionIntentHandler);
  intentMap.set("View Fund Details Intent", viewFundDetailsIntentHandler);
  intentMap.set("Fund Invest Intent", fundInvestIntentHandler);
  intentMap.set("Menu Intent", menuIntentHandler);
  intentMap.set(
    "Mobile Number Validations Intent",
    mobileNumberValidationsIntentHandler
  );
  intentMap.set("Default Fallback Intent", fallbackIntentHandler);
  return intentMap;
}
//#endregion Intent Handler Mapper

//#region  Default Welcome Intent Handler
function defaultWelcomeIntentHandler(agent = new WebhookClient()) {
  userMobileNumber = undefined;
  agent.context.delete("FundExplorerIntent - followup");
  agent.context.delete("selectfundoptionintent-followup");
  agent.context.delete("mobilenumbervalidations");
  agent.add(
    getTelegramPayload(
      "Hi, Welcome to ABC mutual fund services. You can ask about",
      ["Portfolio valuation", "Fund explorer", "Transaction history"]
    )
  );
}
//#endregion

//#region Default fallback intent handler

function fallbackIntentHandler(agent = new WebhookClient()) {
  const context = agent.context;
  // if mobile number is invalid and mobile validation context then it trigger enter a mobile number
  if (context.get("mobilenumbervalidations")?.lifespan) {
    triggerMobileInputEvent(agent);
  }
  // if PAN is invalid and portfoliovaluationintent-followup context is present then it prompt user to enter correct PAN
  else if (context.get("portfoliovaluationintent-followup")) {
    agent.context.set({
      name: "PortfolioValuationIntent-followup",
      lifespan: 2,
      parameters: {},
    });
    agent.add("select folio");
    agent.setFollowupEvent("show_valuations");
  }
  // This block for all other scenarios.
  else {
    agent.add("I missed what you said. What was that?");
  }
}

//#endregion Default fallback intent handler

//#region  Fund Explorer Intents Handler

function fundExplorerIntentHandler(agent = new WebhookClient()) {
  agent.context.delete("validdate");
  agent.context.delete("DefaultWelcomeIntent-followup");
  userMobileNumber = userMobileNumber || agent.parameters["phone-number"];
  agent.add(
    getTelegramPayload(
      "Here are fund categories. you can select to view.\n Quick suggestons",
      ["Equity", "Debt", "Hybrid"]
    )
  );
}

function selectFundOptionIntentHandler(agent = new WebhookClient()) {
  agent.add(
    `To select from the below option(s)
    Enter option number 
    Enter 1 ABC overnight fund
    Enter 2 ABC Liqud fund
    Enter 3 ABC Savings fund`
  );
}

function viewFundDetailsIntentHandler(agent = new WebhookClient()) {
  const userInput = agent.parameters["number"];
  const fundType = getFundType(userInput);
  if (fundType) {
    agent.context.delete("FundExplorerIntent - followup");
    agent.context.delete("selectfundoptionintent-followup");
    agent.add(
      getTelegramPayload(
        `${fundType} fund details:
      The Investment objective of
      the scheme is to provide returns that closey
      correspond to the total returns of the
      securities as represented by the underlying index
      subject to tracking error.
      More details: https://www.google.com
      Quick Suggestions`,
        ["Invest", "Main Menu"]
      )
    );
  } else {
    agent.context.set({
      name: "FundExplorerIntent-followup",
      lifespan: 1,
      parameters: {},
    });
    agent.add("provide valid option");
    agent.setFollowupEvent("SELECT_FUND_OPTIONS");
  }
}

function fundInvestIntentHandler(agent = new WebhookClient()) {
  if (!userMobileNumber || !isValidMobileNumber(userMobileNumber)) {
    triggerMobileInputEvent(agent, {}, 5);
  } else {
    userMobileNumber = undefined;
    agent.end("Thank you for using our services.");
  }
}

function menuIntentHandler(agent = new WebhookClient()) {
  agent.add("Go to Step 1");
  agent.setFollowupEvent("welcome");
}

//#endregion

//#region  Portfolio Valuation Intent Handler

function portfolioValuationIntentHandler(agent = new WebhookClient()) {
  agent.context.delete("PortfolioValuationIntent-followup");
  triggerMobileInputEvent(agent, { options: "Portfolio valuation" }, 5);
}

function showValuationIntentHandler(agent = new WebhookClient()) {
  const panIdentifier = agent.parameters["pan_number"];
  const panRegex = /^abcde1234K_\d+$/;
  if (panRegex.test(panIdentifier)) {
    agent.context.delete("PortfolioValuationIntent-followup");
    userMobileNumber = undefined;
    agent.end(
      `your follo ${panIdentifier}, Valuation ${
        Math.floor(Math.random() * (99999 - 1000 + 1)) + 1000
      } on ${getCurrentDate()}`
    );
  } else {
    agent.add(
      getTelegramPayload("Please select your folo\n Quick suggestion", [
        "abcde1234K_123",
        "abcde1234K_234",
      ])
    );
  }
}

//#endregion

//#region  Transaction History Handler

function extractDates(start, end) {
  let startDate = start;
  let endDate = end;

  // start and end can be object so extract start and end date from it.

  if (isObject(start)) {
    endDate = endDate || start.endDate;
    startDate = start.startDate;
  }
  if (isObject(end)) {
    startDate = startDate || end.startDate;
    endDate = end.endDate;
  }

  return {
    startDate,
    endDate,
  };
}

function transactionHistoryIntentHandler(agent = new WebhookClient()) {
  const { startDate, endDate } = extractDates(
    agent.parameters?.start,
    agent.parameters?.end
  );
  triggerMobileInputEvent(
    agent,
    { options: "Transaction history", endDate: endDate, startDate: startDate },
    5
  );
}

function dateValidationsIntentHandler(agent = new WebhookClient()) {
  const context = agent.context.get("transactionhistoryintent-followup");
  const endDate = context?.parameters?.endDate;
  const startDate = context?.parameters?.startDate;

  if (validateDate(endDate, startDate)) {
    agent.context.delete("DateValidationsIntent-followup");
    agent.context.set({
      name: "validdate",
      lifespan: 5,
      parameters: {},
    });
    agent.add(
      `Purchased Parag Parikh for amount 5000 on ${startDate} \n Purchased HDFC TOP 100 Large CAP for amount 5000 on ${endDate} \n Do you want to invest more?`
    );
  } else {
    addResponseForDate(agent);
  }
}

function dateOptionsIntentHandler(agent = new WebhookClient()) {
  const dateOptions = agent.parameters.date_options;
  if (
    dateOptions === "Current financial year" ||
    dateOptions === "Last financial year"
  ) {
    const yearOffset = dateOptions === "Current financial year" ? 1 : 2;
    const { start, end } = getFinancialYearStartAndEndDate(yearOffset);

    agent.context.set({
      name: "TransactionHistoryIntent-followup",
      lifespan: 1,
      parameters: {
        endDate: end,
        startDate: start,
      },
    });
    agent.add("validate date");
    agent.setFollowupEvent("date_validation");
  } else {
    agent.add("Enter Dates");
  }
}

function enterDateIntentHandler(agent = new WebhookClient()) {
  const { startDate, endDate } = extractDates(
    agent.parameters?.start,
    agent.parameters?.end
  );

  if (!startDate) {
    agent.add("Please provide start date");
    return;
  }
  if (!endDate) {
    agent.add("Please provide end date");
    return;
  }

  agent.context.set({
    name: "TransactionHistoryIntent-followup",
    lifespan: 1,
    parameters: {
      endDate,
      startDate,
    },
  });
  agent.add("validate date");
  agent.setFollowupEvent("date_validation");
}

function noInvestIntentHandler(agent = new WebhookClient()) {
  userMobileNumber = undefined;
  agent.context.delete("validdate");
  agent.end("Thank you for using our services.");
}

function yesInvestIntentHandler(agent = new WebhookClient()) {
  agent.context.set({
    name: "DefaultWelcomeIntent-followup",
    lifespan: 1,
    parameters: {},
  });
  agent.add("Yes, I want more invest");
  agent.setFollowupEvent("fund_explorer_event");
}

function addResponseForDate(agent = new WebhookClient()) {
  agent.add(
    getTelegramPayload("Please provide a time period\n Quick suggestions", [
      "Current financial year",
      "Last financial year",
      "enter dates",
    ])
  );
}
//#endregion

//#region  Handling Mobile

function triggerMobileInputEvent(
  agent = new WebhookClient(),
  parameters = {},
  lifespan = undefined
) {
  agent.add("Please enter mobile number");
  const mobileNumberValidationContext = agent.context.get(
    "mobilenumbervalidations"
  );
  if (mobileNumberValidationContext?.lifespan) {
    parameters = mobileNumberValidationContext.parameters;
    agent.context.set({
      name: "mobilenumbervalidations",
      lifespan: 1,
      parameters,
    });
  } else {
    agent.context.set({
      name: "mobilenumbervalidations",
      lifespan,
      parameters,
    });
  }
  agent.setFollowupEvent("mobile_number_input");
}

function mobileNumberValidationsIntentHandler(agent = new WebhookClient()) {
  userMobileNumber = agent.parameters["phone-number"];
  const parameters = agent.context.get("mobilenumbervalidations")?.parameters;
  const options = parameters?.["options"];

  if (isValidMobileNumber(userMobileNumber)) {
    agent.context.delete("mobilenumbervalidations");
    if (options === "Portfolio valuation") {
      agent.context.set({
        name: "PortfolioValuationIntent-followup",
        lifespan: 5,
        parameters: {},
      });
      agent.add("select folio");
      agent.setFollowupEvent("show_valuations");
    } else if (options === "Transaction history") {
      const endDate = parameters?.endDate;
      const startDate = parameters?.startDate;
      agent.context.set({
        name: "TransactionHistoryIntent-followup",
        lifespan: 1,
        parameters: {
          endDate,
          startDate,
        },
      });
      agent.add("validate date");
      agent.setFollowupEvent("date_validation");
    } else {
      userMobileNumber = undefined;
      agent.end("Thank you for using our services.");
    }
  } else {
    agent.add("Please Enter your registered mobile number");
  }
}

//#endregion

//#region  Helper functions

function getTelegramPayload(text = "", suggestions = []) {
  const inline_keyboard = [];
  suggestions.forEach((Suggestion) => {
    inline_keyboard.push([
      {
        text: Suggestion,
        callback_data: Suggestion,
      },
    ]);
  });

  return new Payload(
    "TELEGRAM",
    {
      telegram: {
        text,
        reply_markup: {
          inline_keyboard,
        },
      },
    },
    {
      sendAsMessage: true,
      rawPayload: true,
    }
  );
}

function isValidMobileNumber(mobileNumber) {
  const mobileNumberRegex = /^[6-9]\d{9}$/;
  return mobileNumberRegex.test(mobileNumber);
}

function getFundType(userInput) {
  switch (userInput) {
    case 1:
      return "ABC overnight";
    case 2:
      return "ABC Liqud";
    case 3:
      return "ABC Savings";
    default:
      return undefined;
  }
}

function validateDate(endDate, startDate) {
  if (endDate && startDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start < end) {
      return !isFutureDate(endDate);
    }
    return false;
  }
  return false;
}

function isFutureDate(date) {
  const currentDate = new Date();
  const inputDate = new Date(date);
  return inputDate > currentDate;
}

function getCurrentDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isObject(variable) {
  return (
    typeof variable === "object" &&
    !Array.isArray(variable) &&
    variable !== null
  );
}

function getFinancialYearStartAndEndDate(yearOffset = 0) {
  const today = new Date();
  const currentYear = today.getFullYear() - yearOffset;

  const financialYearStart = new Date(currentYear, 3, 2);
  const financialYearEnd = new Date(currentYear + 1, 2, 31);

  return {
    start: financialYearStart,
    end: financialYearEnd,
  };
}
//#endregion Helper functions

//#region  Web request code

app.post("/hook", express.json(), (request, response) => {
  const agent = new WebhookClient({ request, response });
  const intentMap = mapIntentHandler();
  agent.handleRequest(intentMap);
});

app.use((error, req, res, next) => console.log(error));
app.listen(process.env.PORT || 8080);

//#endregion Web request code
