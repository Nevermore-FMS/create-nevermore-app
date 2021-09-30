#!/usr/bin/env node

"use strict";

const eaobird = require('./eao_bird_circle.js')
const inquirer = require("inquirer");
const path = require("path");
const packageNameRegex = require("package-name-regex");
const fse = require("fs-extra");
const fs = require("fs");

const JS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-plugin");
const TS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-plugin-ts");

console.log(eaobird)
console.log()
console.log()
console.log("Create Nevermore Plugin - A project by the Edgar Allan Ohms, FRC Team 5276")
console.log()
console.log()

inquirer
  .prompt([
    {
      type: "input",
      name: "name",
      message:
        "What would you like to name this plugin? (Must abide by NPM Package naming scheme)\n>",
      validate(value) {
        const pass = packageNameRegex.test(value);
        if (pass) {
          return true;
        }

        return "Please enter a valid NPM package name.";
      },
    },
    {
      type: "input",
      name: "description",
      message:
        "Write a quick description of your plugin to tell users what to expect:\n>"
    },
    {
      type: "input",
      name: "author",
      message:
        "Enter the name of this plugin's author:\n>"
    },
    {
      type: "input",
      name: "email",
      message:
        "Enter the contact email for this plugin (Leave blank if not used):\n>"
    },
    {
      type: "input",
      name: "url",
      message:
        "Enter the website of this plugin (Leave blank if not used):\n>"
    },
    {
      type: "list",
      name: "pluginType",
      message: "What type of plugin is this?",
      choices: ["GENERIC", "GAME", "NETWORK_CONFIGURATOR"]
    },
    {
      type: "checkbox",
      name: "permissions",
      message: "What permissions would you like to include? (This can be changed later)",
      choices: ["database", "network", "endpoint", "socket", "teams", "scores", "schedules"]
    },
    {
      type: "list",
      name: "language",
      message: "What language do you want to use?",
      choices: ["Javascript (JS)", "Typescript (TS)"],
    }
  ])
  .then((answers) => {
    let isTypescript = answers.language == "Typescript (TS)";
    let outPath = path.join(".", answers.name)

    const writeArgs = [outPath, answers.name, answers.description, answers.author, answers.email, answers.url, answers.pluginType, answers.permissions, isTypescript]

    if (isTypescript) {
      fse.copy(TS_TEMPLATE_DIR, outPath, async function (err) {
        if (err) {
          console.error("Couldn't copy TS template! Error:")
          console.error(err);
        } else {
          await writeJSONToFolder(...writeArgs);
        }
      });
    } else {
      fse.copy(JS_TEMPLATE_DIR, outPath, async function (err) {
        if (err) {
          console.error("Couldn't copy JS template! Error:")
          console.error(err);
        } else {
          await writeJSONToFolder(...writeArgs);
        }
      });
    }
  });

async function writeJSONToFolder(outPath, packageName, description, author, email, url, pluginType, permissions, isTypescript) {
  let nevermoreJSONPath = path.join(outPath, "nevermore.json");
  let packageJSONPath = path.join(outPath, "package.json")

  await fs.promises.writeFile(nevermoreJSONPath, generateNevermoreJSON(packageName, author, email, url, pluginType, permissions));
  await fs.promises.writeFile(packageJSONPath, generatePackageJSON(packageName, author, description, isTypescript));

  console.log("Please run 'npm install' within '" + packageName + "' to begin developing.")
}


function generateNevermoreJSON(name, author, email, url, pluginType, permissions) {
  return JSON.stringify({
    name,
    author,
    email,
    url,
    pluginType,
    permissions,
    pluginPath: "dist/plugin.bundle.js",
    frontendPath: "dist/frontend.bundle.js",
    enabled: true
  }, null, "\t");
}

function generatePackageJSON(name, author, description, isTypescript) {
  if (isTypescript) {
    return JSON.stringify({
      name,
      version: "0.0.0",
      description: description,
      author,
      private: true,
      scripts: {
        "build-js-dev": "webpack --mode=development",
        "build-js": "webpack --mode=production",
        "deploy": "npm run build-js && nevermore-scripts deploy",
        "deploy-dev": "npm run build-js-dev && nevermore-scripts deploy",
        "run-local": "npm run build-js-dev && nevermore-scripts develop",
        "build": "npm run build-js",
        "log": "nevermore-scripts log",
        "develop": "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.2.0",
        "@nevermore-fms/plugin-types": "^0.2.1",
        "nodemon": "2.0.4",
        "ts-loader": "^9.2.3",
        "typescript": "^4.3.4",
        "webpack": "^5.42.0",
        "webpack-cli": "^4.7.2",
      },
      dependencies: {
        react: "^17.0.2",
      },
    }, null, "\t");
  } else {
    return JSON.stringify({
      name,
      version: "0.0.0",
      author,
      private: true,
      scripts: {
        "build-js-dev": "webpack --mode=development",
        "build-js": "webpack --mode=production",
        "deploy": "npm run build-js && nevermore-scripts deploy",
        "deploy-dev": "npm run build-js-dev && nevermore-scripts deploy",
        "run-local": "npm run build-js-dev && nevermore-scripts develop",
        "build": "npm run build-js",
        "log": "nevermore-scripts log",
        "develop": "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.2.0",
        "@nevermore-fms/plugin-types": "^0.2.1",
        "nodemon": "2.0.4",
        "webpack": "^5.42.0",
        "webpack-cli": "^4.7.2",
      },
      dependencies: {
        react: "^17.0.2",
      },
    }, null, "\t");
  }
}
