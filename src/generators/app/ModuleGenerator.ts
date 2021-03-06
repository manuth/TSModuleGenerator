import chalk from "chalk";
import JSON = require("comment-json");
import Dedent = require("dedent");
import { Generator, IComponentProvider, Question } from "extended-yo-generator";
import FileSystem = require("fs-extra");
import KebabCase = require("lodash.kebabcase");
import Path = require("path");
import { isNullOrUndefined } from "util";
import YoSay = require("yosay");
import { IExtensionFile } from "./IExtetensionFile";
import { ILaunchFile } from "./ILaunchFile";
import { IModuleSettings } from "./IModuleSettings";
import { LintMode } from "./LintMode";
import { ModuleComponent } from "./ModuleComponent";
import { ModuleSetting } from "./ModuleSetting";

/**
 * Provides the functionality to generate a generator written in TypeScript.
 */
export class ModuleGenerator extends Generator<IModuleSettings>
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

    /**
     * @inheritdoc
     */
    protected get TemplateRoot(): string
    {
        return "app";
    }

    /**
     * @inheritdoc
     */
    protected get Questions(): Array<Question<IModuleSettings>>
    {
        return [
            {
                type: "input",
                name: ModuleSetting.Destination,
                message: "Where do you want to save your project to?",
                default: "./",
                filter: async input => Path.isAbsolute(input) ? input : Path.resolve(process.cwd(), input)
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
                default: (answers: IModuleSettings) => KebabCase(answers[ModuleSetting.DisplayName])
            },
            {
                type: "input",
                name: ModuleSetting.Description,
                message: "Please enter a description."
            }
        ];
    }

    /**
     * @inheritdoc
     */
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
                                    Source: null,
                                    Destination: "tslint.json",
                                    Process: (source, destination, context, defaultProcess, settings) =>
                                    {
                                        let preset: string;

                                        switch (settings[ModuleSetting.LintMode])
                                        {
                                            case LintMode.Weak:
                                                preset = "@manuth/tslint-presets/weak";
                                                break;
                                            case LintMode.Strong:
                                            default:
                                                preset = "@manuth/tslint-presets/recommended";
                                                break;
                                        }

                                        this.fs.writeJSON(destination, { extends: preset }, null, 4);
                                    }
                                }
                            ]
                        },
                        {
                            ID: ModuleComponent.VSCode,
                            DisplayName: "Visual Studio Code-Workspace",
                            Default: true,
                            FileMappings: [
                                {
                                    Source: () => this.modulePath(".vscode"),
                                    Destination: ".vscode"
                                },
                                {
                                    Source: () => this.modulePath(".vscode", "extensions.json"),
                                    Destination: () => this.destinationPath(".vscode", "extensions.json"),
                                    Process: async (source, destination) =>
                                    {
                                        let result: IExtensionFile = {};
                                        let extensions: typeof result = JSON.parse((await FileSystem.readFile(source)).toString());
                                        result.recommendations = [];

                                        if (!isNullOrUndefined(extensions.recommendations))
                                        {
                                            for (let extension of extensions.recommendations)
                                            {
                                                if (
                                                    (extension !== "qassimfarid.ejs-language-support") &&
                                                    (extension !== "davidanson.vscode-markdownlint"))
                                                {
                                                    result.recommendations.push(extension);
                                                }
                                            }
                                        }

                                        return this.fs.write(destination, JSON.stringify(result, null, 4));
                                    }
                                },
                                {
                                    Source: () => this.modulePath(".vscode", "launch.json"),
                                    Destination: () => this.destinationPath(".vscode", "launch.json"),
                                    Process: async (source, destination) =>
                                    {
                                        let launch: ILaunchFile = JSON.parse((await FileSystem.readFile(source)).toString());

                                        if (!isNullOrUndefined(launch.configurations))
                                        {
                                            let validConfigurations: any[] = [];

                                            for (let configuration of launch.configurations)
                                            {
                                                if ((configuration.name as string).toLowerCase().includes("launch tests"))
                                                {
                                                    validConfigurations.push(configuration);
                                                }
                                            }

                                            launch.configurations = validConfigurations;
                                        }
                                        else
                                        {
                                            launch.configurations = [];
                                        }

                                        launch.configurations.unshift(
                                            {
                                                type: "node",
                                                request: "launch",
                                                name: "Launch Program",
                                                program: "${workspaceFolder}/lib/index.js",
                                                preLaunchTask: "Build"
                                            });

                                        this.fs.write(destination, JSON.stringify(launch, null, 4));
                                    }
                                },
                                {
                                    Source: () => this.modulePath(".vscode", "settings.json"),
                                    Destination: () => this.destinationPath(".vscode", "settings.json"),
                                    Process: async (source, destination) =>
                                    {
                                        let result: { [key: string]: any } = {};
                                        let settings: typeof result = JSON.parse((await FileSystem.readFile(source)).toString());

                                        for (let key in settings)
                                        {
                                            if (
                                                (key !== "files.associations") &&
                                                (key !== "markdownlint.ignore"))
                                            {
                                                result[key] = settings[key];
                                            }
                                        }

                                        this.fs.write(destination, JSON.stringify(result, null, 4));
                                    }
                                },
                                {
                                    Source: () => this.modulePath(".vscode", "tasks.json"),
                                    Destination: () => this.destinationPath(".vscode", "tasks.json"),
                                    Process: async (source, destination) =>
                                    {
                                        let tasks = JSON.parse((await FileSystem.readFile(source)).toString());

                                        if (!isNullOrUndefined(tasks.tasks))
                                        {
                                            let validTasks: any[] = [];

                                            for (let task of tasks.tasks)
                                            {
                                                if (!(task.label as string).toLowerCase().includes("lint"))
                                                {
                                                    validTasks.push(task);
                                                }
                                            }

                                            tasks.tasks = validTasks;
                                        }
                                        else
                                        {
                                            tasks.tasks = [];
                                        }

                                        (tasks.tasks as any[]).push(
                                            {
                                                label: "Lint",
                                                type: "npm",
                                                script: "lint",
                                                problemMatcher: "$tslint5",
                                                presentation: {
                                                    reveal: "never"
                                                }
                                            });

                                        this.fs.write(destination, JSON.stringify(tasks, null, 4));
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * @inheritdoc
     */
    public async prompting()
    {
        this.log(YoSay(`Welcome to the ${chalk.whiteBright("TypeScript-Module")} generator!`));
        return super.prompting();
    }

    /**
     * @inheritdoc
     */
    public async writing()
    {
        let sourceDir = "src";
        this.log(chalk.whiteBright("Generating the Workspace"));

        this.destinationRoot(this.Settings[ModuleSetting.Destination]);
        this.fs.copy(this.templatePath("index.ts.ejs"), this.destinationPath(sourceDir, "index.ts"));
        this.fs.copyTpl(
            this.templatePath("main.test.ts.ejs"),
            this.destinationPath(sourceDir, "tests", "main.test.ts"),
            {
                Name: this.Settings[ModuleSetting.DisplayName]
            });
        this.fs.copy(this.modulePath("test", "mocha.opts"), this.destinationPath("test", "mocha.opts"));
        this.fs.copy(this.templatePath(".gitignore.ejs"), this.destinationPath(".gitignore"));
        this.fs.copy(this.templatePath(".npmignore.ejs"), this.destinationPath(".npmignore"));
        this.fs.writeJSON(this.destinationPath("package.json"), this.GetPackageJSON());
        this.fs.copy(this.modulePath("tsconfig.json"), this.destinationPath("tsconfig.json"));
        this.fs.copyTpl(
            this.templatePath("README.md"),
            this.destinationPath("README.md"),
            {
                Name: this.Settings[ModuleSetting.DisplayName],
                Description: this.Settings[ModuleSetting.Description]
            });
        return super.writing();
    }

    /**
     * @inheritdoc
     */
    public async install()
    {
        this.log(
            Dedent(`
                Your workspace has been generated!

                ${chalk.whiteBright("Installing dependencies...")}`));
        this.npmInstall();
    }

    /**
     * @inheritdoc
     */
    public async end()
    {
        this.log(
            Dedent(
                `
                ${chalk.whiteBright("Finished")}
                Your module "${this.Settings[ModuleSetting.DisplayName]}" has been created!
                To start editing with Visual Studio Code use following command:

                    code "${this.Settings[ModuleSetting.Destination]}"

                Thanks for using TSModuleGenerator!`));
    }

    /**
     * Gets the package-manifest for the generator to generate.
     */
    protected GetPackageJSON = (): {} =>
    {
        let scripts = [
            "build",
            "rebuild",
            "watch",
            "clean",
            "lint",
            "test",
            "prepare"
        ];
        let dependencies: string[] = [];
        let devDependencies = [
            "@manuth/tsconfig",
            "@manuth/tslint-presets",
            "@types/mocha",
            "@types/node",
            "mocha",
            "rimraf",
            "tslint",
            "typescript",
            "typescript-tslint-plugin"
        ];

        let result = {
            name: this.Settings[ModuleSetting.Name],
            version: "0.0.0",
            description: this.Settings[ModuleSetting.Description],
            author: {
                name: this.user.git.name(),
                email: this.user.git.email()
            },
            keywords: [] as string[],
            main: "lib/index.js",
            types: "lib/index.d.ts",
            scripts: {} as { [key: string]: string },
            dependencies: {} as { [key: string]: string },
            devDependencies: {} as { [key: string]: string }
        };

        let packageJSON: typeof result = require(this.modulePath("package.json"));

        for (let script of scripts)
        {
            if (script in packageJSON.scripts)
            {
                if (script === "lint")
                {
                    result.scripts[script] = "tslint -p ./ -t verbose";
                }
                else
                {
                    result.scripts[script] = packageJSON.scripts[script];
                }
            }
        }

        for (let devDependency of devDependencies)
        {
            if (devDependency in packageJSON.devDependencies)
            {
                result.devDependencies[devDependency] = packageJSON.devDependencies[devDependency];
            }
        }

        for (let dependency of dependencies)
        {
            if (dependency in packageJSON.dependencies)
            {
                result.dependencies[dependency] = packageJSON.dependencies[dependency];
            }
        }

        return result;
    }
}