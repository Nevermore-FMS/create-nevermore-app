#!/usr/bin/env node

"use strict";

const { GraphQLClient, gql } = require("graphql-request");
const { createClient } = require("graphql-ws");
const { readFile, readFileSync, createWriteStream, createReadStream, mkdirSync, chmodSync, constants, rmSync } = require("fs");
const Crypto = require("crypto");
const ws = require("ws");
const path = require("path");
const http = require("follow-redirects").https;
const process = require("process");
const { exec, execSync, spawn } = require('child_process');
const chalk = require("chalk");
const yargs = require("yargs");
const { exit } = require("process");

path.join(__dirname)

const bin_path = path.join(__dirname, "..", "bin");

try {
  mkdirSync(bin_path);
} catch(_) {}

const windows_download_url = "https://github.com/Nevermore-FMS/nevermore-fms/releases/download/v0.2.0/nevermore-fms-windows-amd64-developer.exe";
const windows_bin_path = path.join(__dirname, "..", "bin", "nevermore-windows.exe");
const windows_hash = "6f36a581c8a8ca19f30bd621f5dfdf7c48c58e1be64b69c8165cc79d72f4237c";
const linux_download_url = "https://github.com/Nevermore-FMS/nevermore-fms/releases/download/v0.2.0/nevermore-fms-linux-amd64-developer";
const linux_bin_path = path.join(__dirname, "..", "bin", "nevermore-linux");
const linux_hash = "164acba17d39493e2ce5610cf3f337c15fed95788c3235fe1ac96e980075b746";
const osx_download_url = "https://github.com/Nevermore-FMS/nevermore-fms/releases/download/v0.2.0/nevermore-fms-osx-amd64-developer";
const osx_bin_path = path.join(__dirname, "..", "bin", "nevermore-osx");
const osx_hash = "833aedcad2eadc16c7b68c07e2b6b878ba01b74c9bbef68cb01b9fa847b38770";

let unsubscribe = function () {};
let nevermore_process = null;

// Nodemon can kill process.
process.on("SIGUSR2", () => {
  unsubscribe();
  try {
    nevermore_process.kill(0);
  } catch (_) {}
  process.exit(1);
});

const CREATE_WORKER = gql`
  mutation devCreatePlugin(
    $name: String!
    $readme: String!
    $code: String!
    $frontendCode: String!,
    $hasFrontend: Boolean!,
    $enabled: Boolean!,
    $author: String!,
    $email: String!,
    $url: String!,
    $pluginType: PluginType!
  ) {
    devCreatePlugin(
      params: {
        name: $name
        readme: $readme
        code: $code
        frontendCode: $frontendCode
        hasFrontend: $hasFrontend
        enabled: $enabled
        author: $author
        email: $email
        url: $url
        pluginType: $pluginType
      }
    )
  }
`;

const RESTART_WORKER = gql`
  mutation devRestartPlugin() {
    devRestartPlugin
  }
`;

const argv = yargs
  .command("deploy", "Deploys a worker based on the config.")
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to the `nevermore.json` config file.",
  })
  .option("endpoint", {
    alias: "e",
    type: "string",
    description: "The GraphQL endpoint of the Nevermore FMS.",
  })
  .command("develop", "Runs a local instance of Nevermore.")
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to the `nevermore.json` config file.",
  })
  .command("hash", "Gets the hashes of all remote files.")
  .command("log", "Watches the nevermore logger.")
  .option("endpoint", {
    alias: "e",
    type: "string",
    description: "The GraphQL endpoint of the Nevermore FMS.",
    default: "http://localhost:8000/graphql"
  })
  .help()
  .alias("help", "h").argv;

let dir = "nevermore.json";

if (argv.config != undefined) {
  dir = argv.config
}

let name = "no-name";
let author = "";
let email = "";
let url = "";
let pluginType = "";
let pluginPath = "";
let frontendPath = "";
let hasFrontend = false;
let readme = "";
let graphqlEndpoint = "";
let enabled = false;

if (argv.endpoint != undefined) {
  graphqlEndpoint = argv.endpoint
}

try {
  let data = readFileSync(dir, "utf8");
  let config = JSON.parse(data);
  if (config != undefined) {
    if (config.name != undefined && typeof config.name == "string") {
      name = config.name;
    }
    if (
      config.author != undefined &&
      typeof config.author == "string"
    ) {
      author = config.author;
    }
    if (
      config.email != undefined &&
      typeof config.email == "string"
    ) {
      email = config.email;
    }
    if (
      config.url != undefined &&
      typeof config.url == "string"
    ) {
      url = config.url;
    }
    if (
      config.pluginType != undefined &&
      typeof config.pluginType == "string"
    ) {
      pluginType = config.pluginType;
    }
    if (
      config.pluginPath != undefined &&
      typeof config.pluginPath == "string"
    ) {
      pluginPath = config.pluginPath;
    }
    if (
      config.frontendPath != undefined &&
      typeof config.frontendPath == "string"
    ) {
      frontendPath = config.frontendPath;
    }
    if (
      config.hasFrontend != undefined &&
      typeof config.hasFrontend == "boolean"
    ) {
      hasFrontend = config.hasFrontend;
    }
    
    if (config.enabled != undefined && typeof config.enabled == "boolean") {
      enabled = config.enabled;
    }
  }
} catch (e) {
  if (argv._.includes("develop") || argv._.includes("deploy")) {
    console.error("nevermore.json has invalid JSON or doesn't exist.", e);
  }
}

if (argv._.includes("develop")) {
  graphqlEndpoint = "http://localhost:8000/graphql";
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
  readFile(pluginPath, "utf8", function (err, code) {
    if (err) {
      console.error(err);
      return;
    }
    createWorker(requestClient, code);
  });
} else if (argv._.includes("log")) {
  console.clear();
  subscribeToLog(wsClient);
} else if (argv._.includes("develop")) {
  launch_nevermore();
} else if (argv._.includes("hash")) {
  // Windows
  http.get(windows_download_url, function(response) {
    let hashsum = Crypto.createHash("sha256");
    response.pipe(hashsum);

    response.on("end", () => {
      console.log("Windows:", hashsum.digest("hex"))
    });
  }).on("error", (e) => {
    console.log(e)
  });

  // Linux
  http.get(linux_download_url, function(response) {
    let hashsum = Crypto.createHash("sha256");
    response.pipe(hashsum);

    response.on("end", () => {
      console.log("Linux:", hashsum.digest("hex"))
    });
  }).on("error", (e) => {
    console.log(e)
  });

  // OSX
  http.get(osx_download_url, function(response) {
    let hashsum = Crypto.createHash("sha256");
    response.pipe(hashsum);

    response.on("end", () => {
      console.log("OSX:", hashsum.digest("hex"))
    });
  }).on("error", (e) => {
    console.log(e)
  });
} else {
  console.error(
    'Undefined command to run! Ex: "nevermore-scripts deploy <...>"'
  );
  console.log("Use -h or --help for more information.");
}

function createWorker(requestClient, code) {
  requestClient
    .request(CREATE_WORKER, {
      name,
      readme,
      code,
      frontendCode: "test",
      hasFrontend,
      enabled,
      author,
      email,
      url,
      pluginType,
    })
    .then(async (result) => {
      console.log(chalk.bold(chalk.green("\n\nSuccessfully uploaded your code!")));
      requestClient
        .request(RESTART_WORKER)
        .then((result) => {
          console.log(
            chalk.bold(
              chalk.green("Successfully restarted the Nevermore Worker Engine!\n\n")
            )
          );
        })
        .catch((err) => {
          console.log(chalk.red(chalk.bold("Couldn't restart Nevermore Worker Engine.")));
        });
    })
    .catch((err) => {
      console.log(chalk.red(chalk.bold("Couldn't restart Nevermore Worker Engine.")));
    });
}

function httpUrlToWebSocketUrl(url) {
  return url.replace(/(http)(s)?\:\/\//, "ws$2://");
}

function subscribeToLog(wsClient) {
  console.log(chalk.bold(chalk.green("Connecting to the Nevermore Plugin Logger...")));
  new Promise((resolve, reject) => {
    unsubscribe = wsClient.subscribe(
      {
        query:
          "subscription { devLog { message dateTime } }",
      },
      {
        next: function (value) {
          console.log(
            chalk.bold(chalk.blue("[" + value.data.log.dateTime + "]")),
            value.data.log.message.slice(0, -1)
          );
        },
        error: reject,
        complete: resolve,
      }
    );
  }).catch((_) => {
    console.log(chalk.bold(chalk.red("Disconnected from the Nevermore Plugin Logger abnormally.")));
  });
}

async function launch_nevermore() {
  console.log(chalk.bold(chalk.green("Launching Nevermore Developer Build...")));
  if (!(await already_downloaded())) {
    console.log(chalk.bold(chalk.green("Downloading Nevermore Developer Build...")));
    try {
      rmSync(bin_path, { recursive: true, force: true });
      try {
        mkdirSync(bin_path);
      } catch(_) {}
    } catch (_) {}
    let download_url = null;
    let download_hash = null;
    let dest_file = null;
    let err = null;
    switch (process.platform) {
      case "win32":
        download_url = windows_download_url;
        download_hash = windows_hash;
        dest_file = windows_bin_path;
        break
      case "linux":
        download_url = linux_download_url;
        download_hash = linux_hash;
        dest_file = linux_bin_path;
        break
      case "darwin":
        download_url = osx_download_url;
        download_hash = osx_hash;
        dest_file = osx_bin_path;
        break
      default:
        throw "Unsupported Platform";
    }

    let hashsum = Crypto.createHash("sha256");
    let file = createWriteStream(dest_file, { flags: 'w' });

    let successful_download = await new Promise((resolve) => {
      http.get(download_url, function(response) {
        response.pipe(hashsum);
        response.pipe(file);

        file.on("finish", () => {
          file.close();
        })

        response.on("end", () => {
          if (hashsum.digest("hex") == download_hash) {
            resolve(true);
          } else {
            err = "Invalid file signature."
            resolve(false);
          }
        });
      }).on("error", (e) => {
        err = e;
        resolve(false);
      });
    });

    if (!successful_download) {
      throw err;
    }
  }

  let dest_file = null;
  switch (process.platform) {
    case "win32":
      dest_file = windows_bin_path;
      break
    case "linux":
      dest_file = linux_bin_path;
      break
    case "darwin":
      dest_file = osx_bin_path;
      break
    default:
      throw "Unsupported Platform";
  }

  try {
    execSync("chmod +x " + dest_file);
  } catch (_) {}

  nevermore_process = spawn(dest_file, ["-w", "devtools"]);

  nevermore_process.on("error", (err) => {
    try { 
      console.log(err);
      console.log(chalk.red(chalk.bold("Nevermore is exiting abnormally...")));
      unsubscribe();
      process.exit(0);
    } catch (_) {}
  });

  nevermore_process.on("close", () => {
    try { 
      console.log(chalk.red(chalk.bold("Nevermore is exiting normally (You most likely closed the Devtools Windows.)...")));
      unsubscribe();
      process.exit(0);
    } catch (_) {}
  });

  let hasGotMessage = false;
  setTimeout(() => {
    if (!hasGotMessage) {
      console.log(chalk.red(chalk.bold("Nevermore is not able to bind to port 8080...")));
      unsubscribe();
      nevermore_process.kill(1);
      process.exit(0);
    }
  }, 1500);

  nevermore_process.stderr.pipe(process.stderr);

  nevermore_process.stderr.on("data", (msg) => {
    if (msg.includes("listening")) {
      hasGotMessage = true;
      readFile(pluginPath, "utf8", function (err, code) {
        if (err) {
          console.error(err);
          return;
        }

        createWorker(requestClient, code);
      });
    }
  });
}

function already_downloaded() {
  return new Promise((resolve) => {
    let hashsum = Crypto.createHash("sha256");
    let bin_path = null;
    let bin_hash = null;
    switch (process.platform) {
      case "win32":
        bin_path = windows_bin_path;
        bin_hash = windows_hash;
        break
      case "linux":
        bin_path = linux_bin_path;
        bin_hash = linux_hash;
        break
      case "darwin":
        bin_path = osx_bin_path;
        bin_hash = osx_hash;
        break
      default:
        throw "Unsupported Platform";
    }
    let stream = createReadStream(bin_path, { flags: 'r' });

    stream.on("error", () => {
      resolve(false);
    });

    stream.pipe(hashsum);

    stream.on("end", () => {
      if (hashsum.digest("hex") == bin_hash) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}