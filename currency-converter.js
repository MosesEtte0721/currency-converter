import chalk from 'chalk';
import inquirer from 'inquirer';

const API_URL = "https://open.er-api.com/v6/latest"//"https://api.exchangerate-api.com/v6";
const API_KEY = "0c4a175e9581df8d180ec6b2";

// Supported currencies (Frankfurter supports many, we limit for simplicity)
const currencies = ["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "INR", "BRL", "ZAR", "KES"];

function isValidCurrency(currency) {
  return currencies.some(curr => curr === currency.toUpperCase());
}

// Fetch real-time exchange rates (base = fromCurrency)
async function fetchExchangeRates(baseCurrency) {
  try {
    console.log(chalk.yellow(`Fetching latest rates for ${baseCurrency}...`));
    
    const response = await fetch(`${API_URL}/${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.status}`);
    }

    const data = await response.json();
    return data.rates;   // returns object like { "NGN": 1386.5, "EUR": 0.92, ... }
  } catch (error) {
    console.log(chalk.red('Failed to fetch live rates. Using fallback rates.'));
    throw error;
  }
}

// Recursive main function
async function startConversion() {
  try {
    console.log('["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "INR", "BRL", "ZAR", "KES"]')
    console.log(chalk.bold.blue('\n══════════════════════════════════════'));
    console.log(chalk.bold.blue('     REAL-TIME CURRENCY CONVERTER'));
    console.log(chalk.bold.blue('══════════════════════════════════════\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to convert:',
        validate: input => (!isNaN(input) && parseFloat(input) > 0) || 'Amount must be a positive number!'
      },
      {
        type: 'list',
        name: 'from',
        message: 'From Currency:',
        choices: currencies
      },
      {
        type: 'list',
        name: 'to',
        message: 'To Currency:',
        choices: currencies
      }
    ]);

    const amount = parseFloat(answers.amount);
    const fromCurr = answers.from;
    const toCurr = answers.to;

    if (fromCurr === toCurr) {
      throw new Error(`Cannot convert ${fromCurr} to itself.`);
    }

    // Fetch LIVE rates
    const rates = await fetchExchangeRates(fromCurr);

    if (!rates[toCurr]) {
      throw new Error(`Rate for ${toCurr} not available right now.`);
    }

    const conversionRate = rates[toCurr];
    const convertedAmount = amount * conversionRate;

    console.log(chalk.green('\n══════════════════════════════════════'));
    console.log(chalk.white(`${amount} ${fromCurr} = `) + 
                chalk.bold.green(`${convertedAmount.toFixed(2)} ${toCurr}`));
    console.log(chalk.gray(`Live Rate: 1 ${fromCurr} = ${conversionRate.toFixed(4)} ${toCurr}`));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleString()}`));
    console.log(chalk.green('══════════════════════════════════════\n'));

    const again = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Do you want to perform another conversion?',
        default: true
      }
    ]);

    if (again.continue) {
      await startConversion();   // Recursion
    } else {
      console.log(chalk.bold.magenta('\nThank you for using Real-Time Currency Converter! 👋'));
    }

  } catch (error) {
    console.log(chalk.red.bold('\n❌ Error: ' + error.message));

    const retry = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Try again?',
        default: true
      }
    ]);

    if (retry.retry) await startConversion();
    else console.log(chalk.bold.magenta('\nGoodbye!'));
  }
}

// Start the app
console.log(chalk.cyan('Real-Time Currency Converter is ready! 🌍\n'));
startConversion();