/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview JavaScript for Blockly's DevSite demo.
 */
'use strict';


let language = 'pt-br';  // Default to English.

// Run this setup code once while still rendering the head.
(function() {
  const m = location.search.match(/[?&]hl=([^&]+)($|&)/);
  if (m) {
    if (LANGUAGE_NAME[m[1]]) {
      language = m[1];
    }
  }
  // Load Blockly's language strings.
  document.write('<script src="./node_modules/blockly/msg/' + language + '.js"></script>\n');
})();

/**
 * Initialize the page once everything is loaded.
 */
function init() {
  // Sort languages alphabetically.
  const languages = [];
  for (const lang in LANGUAGE_NAME) {
    languages.push([LANGUAGE_NAME[lang], lang]);
  }
  function comp_(a, b) {
    // Sort based on first argument ('English', 'Русский', '简体字', etc).
    if (a[0] > b[0]) return 1;
    if (a[0] < b[0]) return -1;
    return 0;
  };
  languages.sort(comp_);
  // Populate the language selection dropdown.
  var languageMenu = document.getElementById('languageDropdown');
  for (let i = 0; i < languages.length; i++) {
    var tuple = languages[i];
    var lang = tuple[tuple.length - 1];
    var option = new Option(tuple[0], lang);
    if (lang === language) {
      option.selected = true;
    }
    languageMenu.options.add(option);
  }

  // Changing languages involves reloading the page.  To not lose the blocks,
  // they were stored in sessionStorage.  Here we retrieve that data.
  let loadOnce = null;
  try {
    loadOnce = window.sessionStorage.getItem('loadOnceBlocks');
    window.sessionStorage.removeItem('loadOnceBlocks');
    loadOnce = JSON.parse(loadOnce);
  } catch(e) {
    // Storage can be flakey.
    console.log(e);
  }

  // Inject localized category names.
  toolboxJson['contents'][0].name = getMsg('Logic');
  toolboxJson['contents'][1].name = getMsg('Loops');
  toolboxJson['contents'][2].name = getMsg('Math');
  toolboxJson['contents'][3].name = getMsg('Text');
  toolboxJson['contents'][4].name = getMsg('Lists');
  toolboxJson['contents'][5].name = getMsg('Colour');
  // Separator.
  toolboxJson['contents'][7].name = getMsg('Variables');
  toolboxJson['contents'][8].name = getMsg('Procedures');

  // Inject default variable name.
  // https://github.com/google/blockly/issues/5238
  let toolboxString = JSON.stringify(toolboxJson);
  toolboxString = toolboxString.replace(/%\{BKY_VARIABLES_DEFAULT_NAME\}/g,
      Blockly.Msg.VARIABLES_DEFAULT_NAME);
  toolboxJson = JSON.parse(toolboxString);

  // Inject Blockly.
  const workspace = Blockly.inject('blocklyDiv',
      {
        media: "./node_modules/blockly/media/",
        toolbox: toolboxJson,
        rtl: LANGUAGE_RTL.includes(language),
      });
 
 Blockly.serialization.workspaces.load(loadOnce || startBlocks, workspace);
  workspace.addChangeListener(regenerate);
}

/**
 * Look up a category name in the current (human) language.
 */
function getMsg(name) {
  let msg = msgs['en'][name];
  try {
    msg = msgs[language][name] || msg;
  } catch (_e) {
    // Stay with english default.
  }
  return msg;
}

/**
 * Change the (human) language.  Reloads the page.
 */
function languageChange() {
  // Store the blocks in sessionStorage for the duration of the reload.
  const text = JSON.stringify(
      Blockly.serialization.workspaces.save(Blockly.getMainWorkspace()));
  try {
    window.sessionStorage.setItem('loadOnceBlocks', text);
  } catch(e) {
    // Storage can be flakey.
    console.log(e);
  }

  const newLang = document.getElementById('languageDropdown').value;
  window.location.search = '?hl=' + encodeURIComponent(newLang);
}



/**
 * Regenerate the blocks into a (computer) language.
 * Called when the blocks change, or when the target language changes.
 */
function regenerate(_e) {
  if (Blockly.getMainWorkspace().isDragging()) {
    return;  // Don't update code mid-drag.
  }
  const generateLang = document.getElementById('generateDropdown').value;
  const generator = window[generateLang][`${generateLang}Generator`];
  const playButton = document.getElementById('playButton');
  playButton.style.display = (generateLang === 'javascript') ? 'block' : 'none';
  const code = generator.workspaceToCode(Blockly.getMainWorkspace());
  const codeHolder = document.getElementById('codeHolder');
  codeHolder.innerHTML = '';  // Delete old code.
  codeHolder.classList.remove('prettyprinted');
  codeHolder.appendChild(document.createTextNode(code));
  if (typeof PR === 'object') {
    PR.prettyPrint();
  }
}

/**
 * Generate JavaScript from the blocks, then execute it using JS-Interpreter.
 */
function execute() {
  const initFunc = function(interpreter, globalObject) {
    const alertWrapper = function alert(text) {
      return window.alert(arguments.length ? text : '');
    };
    interpreter.setProperty(globalObject, 'alert',
        interpreter.createNativeFunction(alertWrapper));

    const promptWrapper = function prompt(text, defaultValue) {
      return window.prompt(arguments.length > 0 ? text : '',
                            arguments.length > 1 ? defaultValue : '');
    };
    interpreter.setProperty(globalObject, 'prompt',
        interpreter.createNativeFunction(promptWrapper));
  };

  const code = javascript.javascriptGenerator.workspaceToCode(Blockly.getMainWorkspace());
  const myInterpreter = new Interpreter(code, initFunc);
  let stepsAllowed = 10000;
  while (myInterpreter.step() && stepsAllowed) {
    stepsAllowed--;
  }
  if (!stepsAllowed) {
    throw EvalError('Infinite loop.');
  }
}


function generateJSONFile() {
  const workspace = Blockly.getMainWorkspace();
  var json = Blockly.serialization.workspaces.save(workspace);
  var data = JSON.stringify(json, null, 2);
  var filename = 'blocos.json';

  // Solicitar um nome para o arquivo
  var filename = prompt('Informe um nome para o arquivo:', 'blocos');
  if (filename) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
    element.setAttribute('download', filename + ".json");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }
}


// Função para lidar com o upload do arquivo JSON
function loadJsonFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  var reader = new FileReader();

  reader.onload = function(e) {
    var contents = e.target.result;
    var json = JSON.parse(contents);
    const workspace = Blockly.getMainWorkspace();
    Blockly.serialization.workspaces.load(json, workspace);
  };

  reader.readAsText(file);
}







/**
 * Initial blocks when loading page.
 */
const startBlocks = {
  "blocks": {
    "languageVersion": 0,
    "blocks": [
      {
        "type": "variables_set",
        "x": 10,
        "y": 10,
        "fields": {
          "VAR": {"id": "Count"}
        },
        "inputs": {
          "VALUE": {
            "block": {
              "type": "math_number",
              "fields": {"NUM": 1}
            }
          }
        },
        "next": {
          "block": {
            "type": "controls_whileUntil",
            "fields": {"MODE": "WHILE"},
            "inputs": {
              "BOOL": {
                "block": {
                  "type": "logic_compare",
                  "fields": {"OP": "LTE"},
                  "inputs": {
                    "A": {
                      "block": {
                        "type": "variables_get",
                        "fields": {
                          "VAR": {"id": "Count"}
                        }
                      }
                    },
                    "B": {
                      "block": {
                        "type": "math_number",
                        "fields": {"NUM": 3}
                      }
                    }
                  }
                }
              },
              "DO": {
                "block": {
                  "type": "text_print",
                  "inputs": {
                    "TEXT": {
                      "block": {
                        "type": "text",
                        "fields": {"TEXT": "Hello World!"}
                      }
                    }
                  },
                  "next": {
                    "block": {
                      "type": "variables_set",
                      "fields": {
                        "VAR": {"id": "Count"}
                      },
                      "inputs": {
                        "VALUE": {
                          "block": {
                            "type": "math_arithmetic",
                            "fields": {"OP": "ADD"},
                            "inputs": {
                              "A": {
                                "block": {
                                  "type": "variables_get",
                                  "fields": {
                                    "VAR": {"id": "Count"}
                                  }
                                }
                              },
                              "B": {
                                "block": {
                                  "type": "math_number",
                                  "fields": {"NUM": 1}
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "variables": [
    {
      "name": "Count",
      "id": "Count"
    }
  ]
};
