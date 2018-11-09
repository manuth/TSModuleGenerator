import chalk from "chalk";
import dedent = require("dedent");
import kebabCase = require("lodash.kebabcase");
import Path = require("path");
import { Question } from "yeoman-generator";
import yosay = require("yosay");
import { Generator } from "../../Generator";
import { IComponentProvider } from "../../IComponentProvider";
import { IModuleSettings } from "./IModuleSettings";
import { LintMode } from "./LintMode";
import { ModuleComponent } from "./ModuleComponent";
import { ModuleSetting } from "./ModuleSetting";

/**
 * Provides the functionality to generate a generator written in TypeScript.
 */
class ModuleGenerator extends Generator<IModuleSettings>
{
    /**
     * Initializes a new instance of the `AppGenerator` class.
     *
     * @param args
     * A set of arguments for the generator.
     *
     * @param options
     * A set of options for the generator.
     */
    public constructor(args: string | string[], options: {})
    {
        super(args, options);
    }

    protected get TemplateRoot(): string
    {
        return "app";
    }

    protected get Questions(): Question[]
    {
        return [
            {
                type: "input",
                name: ModuleSetting.Destination,
                message: "Where do you want to save your project to?",
                default: "./",
                filter: async input =>
                {
                    let destination = Path.isAbsolute(input) ? input : Path.resolve(process.cwd(), input);
                    this.destinationRoot(destination);
                    return destination;
                }
            },
            {
                type: "input",
                name: ModuleSetting.DisplayName,
                message: "What's the name of your project?",
                default: (answers: IModuleSettings) => Path.basename(answers[ModuleSetting.Destination])
            },
            {
                type: "input",
                name: ModuleSetting.Name,
                message: "What's the name of the module to generate?",
                default: (answers: IModuleSettings) => kebabCase(answers[ModuleSetting.DisplayName])
            },
            {
                type: "input",
                name: ModuleSetting.Description,
                message: "Please enter a description."
            }
        ];
    }

    protected get ProvidedComponents(): IComponentProvider<IModuleSettings>
    {
        return {
            Question: "What do you want to include in your workspace?",
            Categories: [
                {
                    DisplayName: "General",
                    Components: [
                        {
                            ID: ModuleComponent.TSLint,
                            DisplayName: "TSLint configurations",
                            Default: true,
                            Questions: [
                                {
                                    name: ModuleSetting.LintMode,
                                    type: "list",
                                    message: "What ruleset do you want to use for linting?",
                                    choices: [
                                        {
                                            value: LintMode.Weak,
                                            name: "manuth's weak ruleset"
                                        },
                                        {
                                            value: LintMode.Strong,
                                            name: "manuth's strong ruleset (recommended)"
                                        }
                                    ],
                                    default: LintMode.Strong
                                }
                            ],
                            FileMappings: [
                                {
                                    Source: (settings) =>
                                    {
                                        switch (settings[ModuleSetting.LintMode])
                                        {
                                            case LintMode.Weak:
                                                return "tslint.weak.jsonc";
                                            case LintMode.Strong:
                                            default:
                                                return this.modulePath("tslint.json");
                                        }
                                    },
                                    Destination: "tslint.json"
                                }
                            ]
                        },
                        {
                            ID: ModuleComponent.VSCode,
                            DisplayName: "Visual Studio Code-Workspace",
                            Default: true,
                            FileMappings: [
                                {
                                    Source: this.modulePath(".vscode"),
                                    Destination: ".vscode"
                                },
                                {
                                    Source: "launch.json",
                                    Destination: () => this.destinationPath(".vscode", "launch.json")
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    public async prompting()
    {
        this.log(yosay(`Welcome to the ${chalk.whiteBright("TypeScript-Module")} generator!`));
        return super.prompting();
    }

    public async writing()
    {
        let sourceDir = "src";
        let packageJSON = require(this.modulePath("package.json"));
        let devPackages = [
            "@types/mocha",
            "@types/node",
            "mocha",
            "tslint",
            "typescript"
        ];
        let devDependencies: { [key: string]: string } = {};
        for (let dependency in packageJSON.devDependencies)
        {
            if (devPackages.includes(dependency))
            {
                devDependencies[dependency] = packageJSON.devDependencies[dependency];
            }
        }

        this.fs.copy(this.templatePath("index.ts.ejs"), this.destinationPath(sourceDir, "index.ts"));
        this.fs.copyTpl(
            this.templatePath("main.test.ts.ejs"),
            this.destinationPath(sourceDir, "tests", "main.test.ts"),
            {
                Name: this.Settings[ModuleSetting.DisplayName]
            });
        this.fs.copy(this.modulePath("test", "mocha.opts"), this.destinationPath("test", "mocha.opts"));
        this.fs.copy(this.modulePath(".gitignore"), this.destinationPath(".gitignore"));
        this.fs.copy(this.modulePath(".npmignore"), this.destinationPath(".npmignore"));
        this.fs.writeJSON(
            this.destinationPath("package.json"),
            {
                name: this.Settings[ModuleSetting.Name],
                version: "0.0.0",
                description: this.Settings[ModuleSetting.Description],
                scripts: packageJSON.scripts,
                author: {
                    name: this.user.git.name(),
                    email: this.user.git.email()
                },
                main: "lib/index.js",
                types: "lib/index.d.ts",
                devDependencies
            });
        this.fs.copy(this.modulePath("tsconfig.json"), this.destinationPath("tsconfig.json"));
        this.fs.copyTpl(
            this.templatePath("README.md.ejs"),
            this.destinationPath("README.md"),
            {
                Name: this.Settings[ModuleSetting.DisplayName],
                Description: this.Settings[ModuleSetting.Description]
            });
        return super.writing();
    }

    public async install()
    {
        this.log(dedent(`
            Your workspace has been generated!

            ${chalk.whiteBright("Installing dependencies...")}`));
        this.npmInstall();
    }

    public async end()
    {
        this.log(dedent(`
            Your Node-Moulde has been Generated!
            Open it up using this command:

            code "${this.Settings[ModuleSetting.Destination]}"`));
    }
}

export = ModuleGenerator;