import chalk from 'chalk';
import inquirer from 'inquirer';



const API_URL = "https://open.er-api.com/v6/latest";



// Supported currencies
const currencies = ["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "INR", "BRL", "ZAR", "KES"];

//  labels mapped to each currency code.
// Used by buildChoices() to render descriptive menu items in the inquirer prompt.
const currencyLabels = {
  NGN: "Nigerian Naira",   USD: "US Dollar",        EUR: "Euro",
  GBP: "British Pound",    JPY: "Japanese Yen",     CAD: "Canadian Dollar",
  INR: "Indian Rupee",     BRL: "Brazilian Real",   ZAR: "South African Rand",
  KES: "Kenyan Shilling"
};

// ─── ES6 Array helper functions ─────────────────────────────────────────────

/**
 * Checks whether the given currency code exists in the supported currencies list.
 * Uses the native ES6 Array .some() method to scan the array and return true
 * on the first match. Comparison is case-insensitive via .toUpperCase().
 
 * this function existed in the original code but was never calle
 *  use fetchExchangeRates() to reject
 * an unsupported base currency before making any network request.
 
 * @param {string} currency - The currency code to validate ("usd" or "USD").
 * @returns {boolean} true if the currency is supported, false otherwise.
 
 */
function isValidCurrency(currency) {
  return currencies.some(curr => curr === currency.toUpperCase());
}

/**
 * Returns a new array of currency codes with the specified currency removed.
 * Uses the native ES6 Array .filter() method to exclude the base ("from")
 * currency so that the "to" currency list never contains the same option,
 * preventing a pointless same-currency conversion without extra validation logic.
 *
 * @param {string} excludeCurrency - The currency code to remove (e.g. "USD").
 * @returns {string[]} A filtered array of currency codes.
 */
function getTargetCurrencies(excludeCurrency) {
  return currencies.filter(curr => curr !== excludeCurrency);
}

/**
 * Converts an array of currency codes into an array of inquirer choice objects,
 * each with a human-readable display label and the raw code as the value.
 * Uses the native ES6 Array .map() method to transform every code into the
 * shape { name: "USD — US Dollar", value: "USD" } that inquirer expects.
 * Falls back to the raw code if no label entry exists in currencyLabels.
 *
 * @param {string[]} currencyList - Array of currency codes to transform.
 * @returns {{ name: string, value: string }[]} Inquirer-compatible choice objects.
 */
function buildChoices(currencyList) {
  return currencyList.map(curr => ({
    name: `${curr} — ${currencyLabels[curr] ?? curr}`,
    value: curr
  }));
}

/**
 * Checks whether the target currency key is present in the rates object
 * returned by the API. Uses Object.keys() combined with the native ES6
 * Array .includes() method to perform the lookup.
 * Prevents a silent NaN conversion when a rate key is unexpectedly absent.
 *
 * @param {Object} rates  - The rates object from the API response (e.g. { USD: 1.0, EUR: 0.92 }).
 * @param {string} toCurr - The target currency code to look up (e.g. "EUR").
 * @returns {boolean} true if the rate exists, false otherwise.
 */
function rateExists(rates, toCurr) {
  return Object.keys(rates).includes(toCurr);
}

// ─── Network ─────────────────────────────────────────────────────────────────

/**
 * Fetches the latest exchange rates from the open.er-api.com API for the
 * given base currency and returns the rates object.
 *
 * Steps performed:
 *  1. Validates baseCurrency with isValidCurrency() — throws a custom Error
 *     immediately if the code is unsupported, satisfying the "throw exceptions"
 *     additional requirement without making a wasted network call.
 *  2. Calls the API endpoint and checks response.ok — throws a descriptive
 *     Error with the HTTP status code if the request failed.
 *  3. Validates that data.rates exists and is an object — throws if the API
 *     returned an unexpected payload shape.
 *  4. Re-throws any caught error so the caller (startConversion) can present
 *     a user-facing message and offer a retry.
 *
 * @async
 * @param {string} baseCurrency - The ISO 4217 currency code to use as the base (e.g. "USD").
 * @returns {Promise<Object>} Resolves to a rates object mapping currency codes to
 *                            their exchange rate relative to baseCurrency
 *                            (e.g. { NGN: 1540.5, EUR: 0.92, ... }).
 * @throws {Error} If baseCurrency is unsupported, the network request fails,
 *                 or the API response is malformed.
 */
async function fetchExchangeRates(baseCurrency) {

  if (!isValidCurrency(baseCurrency)) {
    throw new Error(`Unsupported base currency: "${baseCurrency}". ` +
                    `Supported: ${currencies.join(', ')}`);
  }

  try {
    console.log(chalk.yellow(`\nFetching latest rates for ${baseCurrency}...`));
    const response = await fetch(`${API_URL}/${baseCurrency}`);

    if (!response.ok) {
      throw new Error(`API request failed (HTTP ${response.status}). ` +
                      `Check your internet connection and try again.`);
    }

    const data = await response.json();

    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('API returned an unexpected response format.');
    }

    return data.rates; // { "USD": 0.00065, "EUR": 0.00060, ... }

  } catch (error) {
    // Re-throw so the caller's catch block handles user-facing messaging.
    throw error;
  }
}

// ─── Conversion UI ───────────────────────────────────────────────────────────

/**
 * Runs a single end-to-end currency conversion interaction:
 *  1. Displays the app banner.
 *  2. Prompts the user for an amount and a "from" currency using inquirer list menus.
 *  3. Builds the "to" currency choices by filtering out the selected "from" currency
 *     (via getTargetCurrencies + buildChoices) so the same currency can never appear twice.
 *  4. Prompts the user to select the target currency.
 *  5. Calls fetchExchangeRates() to retrieve live rates — may throw on network error.
 *  6. Verifies the target rate exists in the response via rateExists() — throws if missing.
 *  7. Computes the converted amount and prints a formatted result to the terminal
 *     using chalk for colour and styling.
 *
 * This function does NOT handle its own errors; any thrown exception bubbles up
 * to startConversion() which catches it and offers the user a retry.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} Propagated from fetchExchangeRates() or thrown directly when
 *                 the target rate is absent from the API response.
 */
async function runOneConversion() {
  console.log(chalk.bold.blue('\n══════════════════════════════════════'));
  console.log(chalk.bold.blue('      REAL-TIME CURRENCY CONVERTER    '));
  console.log(chalk.bold.blue('══════════════════════════════════════\n'));

  const { amount, from: fromCurr } = await inquirer.prompt([
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount to convert:',
      validate: input =>
        (!isNaN(input) && parseFloat(input) > 0) || 'Amount must be a positive number!'
    },
    {
      type: 'list',
      name: 'from',
      message: 'From Currency:',
      choices: buildChoices(currencies)   // uses .map()
    }
  ]);

  // .filter() removes the chosen "from" currency so the list can't match itself.
  const toChoices = buildChoices(getTargetCurrencies(fromCurr));

  const { to: toCurr } = await inquirer.prompt([
    {
      type: 'list',
      name: 'to',
      message: 'To Currency:',
      choices: toChoices
    }
  ]);

  // Fetch live rates — may throw; caller handles it.
  const rates = await fetchExchangeRates(fromCurr);

  // .includes() via rateExists() — throw if the rate is missing from the response.
  if (!rateExists(rates, toCurr)) {
    throw new Error(`Rate for "${toCurr}" was not returned by the API.`);
  }

  const conversionRate  = rates[toCurr];
  const convertedAmount = parseFloat(amount) * conversionRate;

  console.log(chalk.green('\n══════════════════════════════════════'));
  console.log(
    chalk.white(`  ${amount} ${fromCurr}  =  `) +
    chalk.bold.green(`${convertedAmount.toFixed(2)} ${toCurr}`)
  );
  console.log(chalk.gray(`  Live Rate : 1 ${fromCurr} = ${conversionRate.toFixed(6)} ${toCurr}`));
  console.log(chalk.gray(`  Updated   : ${new Date().toLocaleString()}`));
  console.log(chalk.green('══════════════════════════════════════\n'));
}

// ─── Error handling + recursion ──────────────────────────────────────────────

/**
 * Wraps runOneConversion() in a try/catch to provide graceful error handling
 * and a recursive retry mechanism (satisfying the Recursion requirement).
 *
 * On success: returns normally so the caller (main) can ask the user whether
 * to convert again via the iterative while loop.
 *
 * On error: prints the error message in red, then prompts the user:
 *  If they choose to retry → calls startConversion() recursively,
 *    starting a fresh attempt from a clean call frame.
 *   If they decline        → prints a goodbye message and exits the process.
 *
 * Bug fix 4: the original code used recursion for the normal "convert again"
 * path too, which would overflow the call stack after many conversions.
 * Recursion is now reserved only for this error-retry path, which is bounded
 * by the user's willingness to retry and is semantically meaningful.
 *
 * @async
 * @returns {Promise<void>}
 */
async function startConversion() {
  try {
    await runOneConversion();
  } catch (error) {
    // Handle thrown exceptions and offer a recursive retry.
    console.log(chalk.red.bold('\n❌ Error: ' + error.message));

    const { retry } = await inquirer.prompt([{
      type: 'confirm',
      name: 'retry',
      message: 'Would you like to try again?',
      default: true
    }]);

    if (retry) {
      await startConversion(); // Recursion — retrying after an error.
    } else {
      console.log(chalk.bold.magenta('\nGoodbye! 👋'));
      process.exit(0);
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Application entry point. Prints the welcome banner and supported currency list,
 * then runs the main conversion loop.
 *
 * Uses an iterative while loop (not recursion) for the "convert again" path so
 * that repeated conversions do not grow the call stack. 
 * Each iteration calls
 * startConversion() which handles one full conversion attempt (including any
 * error retries via recursion). 
 * After each successful conversion the user is
 * asked whether they want to convert another currency; answering "no" breaks
 * the loop, prints a farewell message, and the process exits normally.
 *
 * @async
 * @returns {Promise<void>}
 */
async function main() {
  console.log(chalk.cyan.bold('Real-Time Currency Converter is ready! 🌍\n'));
  console.log(chalk.dim('Supported: ' + currencies.join(' · ') + '\n'));

  // Iterative play-again loop — no stack growth across normal conversions.
  while (true) {
    await startConversion();

    const { again } = await inquirer.prompt([{
      type: 'confirm',
      name: 'again',
      message: 'Convert another currency?',
      default: true
    }]);

    if (!again) {
      console.log(chalk.bold.magenta('\nThank you for using Real-Time Currency Converter! 👋'));
      break;
    }
  }
}

main();

/*
*   Please not that
*
*/
