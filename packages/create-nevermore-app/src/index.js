#!/usr/bin/env node

"use strict";

const inquirer = require("inquirer");
const path = require("path");
const packageNameRegex = require("package-name-regex");
const fse = require("fs-extra");
const fs = require("fs").promises;
const { exec } = require('child_process');

const MODE_0666 = parseInt("0666", 8);
const MODE_0755 = parseInt("0755", 8);
const JS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-worker");
const TS_TEMPLATE_DIR = path.join(__dirname, "..", "templates", "nevermore-worker-ts");

inquirer
  .prompt([
    {
      type: "input",
      name: "name",
      message:
        "What would you like to name this worker? (Must abide by NPM Package naming scheme)\n>",
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
        "Write a quick description of your worker to tell users what to expect:"
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
      message: "Would you like to run `npm install` after this worker is created?"
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
					await writeJSONToFolder(outPath, answers.name, answers.description, isTypescript, answers.runNPMInstall);
				}
			});
		} else {
			fse.copy(JS_TEMPLATE_DIR, outPath, async function (err) {
				if (err) {
					console.error("Couldn't copy JS template! Error:")
					console.error(err); 
				} else {
					await writeJSONToFolder(outPath, answers.name, answers.description, isTypescript, answers.runNPMInstall);
				}
			});
		}
  });

async function writeJSONToFolder(outPath, packageName, description, isTypescript, runNPMInstall) {
	let nevermoreJSONPath = path.join(outPath, "nevermore.json");
	let packageJSONPath = path.join(outPath, "package.json")

	await fs.writeFile(nevermoreJSONPath, generateNevermoreJSON(packageName, description));
	await fs.writeFile(packageJSONPath, generatePackageJSON(packageName, description, isTypescript));

	if (runNPMInstall) {
		let child = exec("npm i --cwd " + outPath + " --prefix " + outPath);

		child.on('exit', function (code, signal) {
			console.log(`The worker ${packageName} has been created at "${outPath}"!`)
		});

		child.on('error', function (err) {
			console.log(err)
		})

		child.stdout.on('data', (data) => {
			console.log(data);
		});
		
		child.stderr.on('data', (data) => {
			console.error(data);
		});
	}
}


function generateNevermoreJSON(packageName, description) {
  return JSON.stringify({
    name: packageName,
    description: description,
    workerPath: "dist/worker.bundle.js",
    graphqlEndpoint: "http://localhost:8000/graphql",
    enabled: true
  }, null, "\t");
}

function generatePackageJSON(packageName, description, isTypescript) {
  if (isTypescript) {
    return JSON.stringify({
      name: packageName,
      version: "0.0.0",
			description: description,
      private: true,
      scripts: {
        "build-dev": "webpack --mode=development",
        build: "webpack --mode=production",
        deploy: "npm run build && nevermore-scripts deploy",
        "deploy-dev": "npm run build-dev && nevermore-scripts deploy",
        develop: "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.0.1",
        "@nevermore-fms/worker-types": "^0.0.1",
        nodemon: "2.0.4",
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
      name: packageName,
      version: "0.0.0",
      private: true,
      scripts: {
        "build-dev": "webpack --mode=development",
        build: "webpack --mode=production",
        deploy: "npm run build && nevermore-scripts deploy",
        "deploy-dev": "npm run build-dev && nevermore-scripts deploy",
        develop: "nodemon",
      },
      devDependencies: {
        "@types/react": "^17.0.11",
        "@nevermore-fms/scripts": "^0.0.1",
        "@nevermore-fms/worker-types": "^0.0.1",
        nodemon: "2.0.4",
        webpack: "^5.42.0",
        "webpack-cli": "^4.7.2",
      },
      dependencies: {
        react: "^17.0.2",
      },
    }, null, "\t");
  }
}
