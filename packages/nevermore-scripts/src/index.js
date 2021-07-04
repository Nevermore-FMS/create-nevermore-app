#!/usr/bin/env node

"use strict";

const { GraphQLClient, gql } = require("graphql-request");
const { createClient } = require("graphql-ws");
const { readFile, readFileSync } = require("fs");
const Crypto = require("crypto");
const ws = require("ws");
const process = require("process");
const chalk = require("chalk");
const yargs = require("yargs");

let unsubscribe = function () {};

// Nodemon can kill process.
process.on("SIGUSR2", () => {
  unsubscribe();
  process.exit(0);
});

const CREATE_WORKER = gql`
  mutation createWorker(
    $name: String!
    $description: String!
    $code: String!
    $enabled: Boolean!
  ) {
    createWorker(
      params: {
        name: $name
        description: $description
        code: $code
        enabled: $enabled
      }
    )
  }
`;

const RESTART_WORKER = gql`
  mutation restartWorker() {
    restartWorker
  }
`;

const argv = yargs
  .command("deploy", "Deploys a worker based on the config.")
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to the `nevermore.json` config file.",
  })
  .command("log", "Watches the nevermore logger.")
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to the `nevermore.json` config file.",
  })
  .help()
  .alias("help", "h").argv;

let dir = "nevermore.json";

if (argv.config != undefined) {
  dir = argv.config
}

let name = "no-name";
let description = "";
let workerPath = "";
let graphqlEndpoint = "";
let enabled = false;
try {
  let data = readFileSync("nevermore.json", "utf8");
  let config = JSON.parse(data);
  if (config != undefined) {
    if (config.name != undefined && typeof config.name == "string") {
      name = config.name;
    }
    if (
      config.description != undefined &&
      typeof config.description == "string"
    ) {
      description = config.description;
    }
    if (
      config.workerPath != undefined &&
      typeof config.workerPath == "string"
    ) {
      workerPath = config.workerPath;
    }
    if (
      config.graphqlEndpoint != undefined &&
      typeof config.graphqlEndpoint == "string"
    ) {
      graphqlEndpoint = config.graphqlEndpoint;
    }
    if (config.enabled != undefined && typeof config.enabled == "boolean") {
      enabled = config.enabled;
    }
  }
} catch (e) {
  console.error("nevermore.json has invalid JSON or doesn't exist.", e);
}

const requestClient = new GraphQLClient(graphqlEndpoint);
const wsClient = createClient({
  url: httpUrlToWebSocketUrl(graphqlEndpoint),
  webSocketImpl: ws,
  generateID: () =>
    ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (Crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
    ),
});

if (argv._.includes("deploy")) {
  readFile(workerPath, "utf8", function (err, code) {
    if (err) {
      console.error(err);
      return;
    }
    createWorker(requestClient, wsClient, code);
  });
} else if (argv._.includes("log")) {
  console.clear();
  subscribeToLog(wsClient);
} else {
  console.error(
    'Undefined command to run! Ex: "nevermore-scripts deploy <...>"'
  );
  console.log("Use -h or --help for more information.");
}

function createWorker(requestClient, wsClient, code) {
  console.clear();
  subscribeToLog(wsClient);
  requestClient
    .request(CREATE_WORKER, {
      name,
      description,
      code,
      enabled,
    })
    .then(async (result) => {
      console.log(chalk.bold(chalk.green("Successfully uploaded your code!")));
      requestClient
        .request(RESTART_WORKER)
        .then((result) => {
          console.log(
            chalk.bold(
              chalk.green("Successfully restarted the Nevermore Worker Engine!")
            )
          );
        })
        .catch((_) => {});
    })
    .catch((_) => {});
}

function httpUrlToWebSocketUrl(url) {
  return url.replace(/(http)(s)?\:\/\//, "ws$2://");
}

async function subscribeToLog(wsClient) {
  console.log(chalk.bold(chalk.green("Successfully connected to the Nevermore Worker Logger.")));
  await new Promise((resolve, reject) => {
    unsubscribe = wsClient.subscribe(
      {
        query:
          "subscription { log { message level callingFunction fileName dateTime } }",
      },
      {
        next: function (value) {
          console.log(
            chalk.bold(chalk.blue("[" + value.data.log.dateTime + "]")),
            chalk.bold(
              chalk.green(
                "<" +
                  value.data.log.fileName +
                  " | " +
                  value.data.log.callingFunction +
                  "> "
              )
            ),
            value.data.log.message.slice(0, -1)
          );
        },
        error: reject,
        complete: resolve,
      }
    );
  });
}
