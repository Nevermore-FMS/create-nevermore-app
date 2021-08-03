#!/usr/bin/env node

"use strict";

const inquirer = require("inquirer");
const path = require("path");
const packageNameRegex = require("package-name-regex");
const fse = require("fs-extra");
const fs = require("fs").promises;
const { exec } = require("child_process");

const JS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-plugin");
const TS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-plugin-ts");

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
      choices: ["GAME", "NETWORK_CONFIGURATOR", "GENERIC"]
    },
    {
      type: "list",
      name: "language",
      message: "What language do you want to use?",
      choices: ["Javascript (JS)", "Typescript (TS)"],
    },
		{
      type: "confirm",
      name: "runNPMInstall",
      message: "Would you like to run `npm install` after this plugin is created?"
    }
  ])
  .then((answers) => {
    let isTypescript = answers.language == "Typescript (TS)";
		let outPath = path.join(".", answers.name)

		if (isTypescript) {
			fse.copy(TS_TEMPLATE_DIR, outPath, async function (err) {
				if (err) {
					console.error("Couldn't copy TS template! Error:")
					console.error(err); 
				} else {
					await writeJSONToFolder(outPath, answers.name, answers.description, answers.author, answers.email, answers.url, answers.pluginType, isTypescript, answers.runNPMInstall);
				}
			});
		} else {
			fse.copy(JS_TEMPLATE_DIR, outPath, async function (err) {
				if (err) {
					console.error("Couldn't copy JS template! Error:")
					console.error(err); 
				} else {
					await writeJSONToFolder(outPath, answers.name, answers.description, answers.author, answers.email, answers.url, answers.pluginType, isTypescript, answers.runNPMInstall);
				}
			});
		}
  });

async function writeJSONToFolder(outPath, packageName, description, author, email, url, pluginType, isTypescript, runNPMInstall) {
	let nevermoreJSONPath = path.join(outPath, "nevermore.json");
	let packageJSONPath = path.join(outPath, "package.json")

	await fs.writeFile(nevermoreJSONPath, generateNevermoreJSON(packageName, author, email, url, pluginType));
	await fs.writeFile(packageJSONPath, generatePackageJSON(packageName, author, description, isTypescript));

	if (runNPMInstall) {
		let child = exec("npm i --cwd " + outPath + " --prefix " + outPath);

		child.on('exit', function (code, signal) {
			console.log(`The worker ${packageName} has been created at "${outPath}"!`)
		});

		child.on('error', function (err) {
			console.log(err)
		});

		child.stdout.on('data', (data) => {
			console.log(data);
		});
		
		child.stderr.on('data', (data) => {
			console.error(data);
		});
	}
}


function generateNevermoreJSON(name, author, email, url, pluginType) {
  return JSON.stringify({
    name,
    author,
    email,
    url,
    pluginType,
    pluginPath: "dist/plugin.bundle.js",
    frontendPath: "dist/frontend.bundle.js",
    hasFrontend: true,
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
        deploy: "npm run build-js && nevermore-scripts deploy",
        "deploy-dev": "npm run build-js-dev && nevermore-scripts deploy",
        "run-local": "npm run build-js-dev && nevermore-scripts develop",
        "build": "npm run build-js && cp nevermore.json dist/nevermore.json && cp README.md dist/README.md && cd dist && bestzip plugin.zip *",
        "log": "nevermore-scripts log",
        develop: "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.1.1",
        "@nevermore-fms/plugin-types": "^0.1.0",
        nodemon: "2.0.4",
        bestzip: "2.2.0",
        "ts-loader": "^9.2.3",
        typescript: "^4.3.4",
        webpack: "^5.42.0",
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
        deploy: "npm run build-js && nevermore-scripts deploy",
        "deploy-dev": "npm run build-js-dev && nevermore-scripts deploy",
        "run-local": "npm run build-js-dev && nevermore-scripts develop",
        "build": "npm run build-js && cp nevermore.json dist/nevermore.json && cp README.md dist/README.md && cd dist && bestzip plugin.zip *",
        "log": "nevermore-scripts log",
        develop: "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.1.1",
        "@nevermore-fms/plugin-types": "^0.1.0",
        nodemon: "2.0.4",
        bestzip: "2.2.0",
        webpack: "^5.42.0",
        "webpack-cli": "^4.7.2",
      },
      dependencies: {
        react: "^17.0.2",
      },
    }, null, "\t");
  }
}
