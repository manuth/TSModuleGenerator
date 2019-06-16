import Assert = require("assert");
import { spawnSync } from "child_process";
import npmWhich = require("npm-which");
import Path = require("path");
import { run, RunContext } from "yeoman-test";
import { LintMode } from "../../generators/app/LintMode";
import { ModuleGenerator } from "../../generators/app/ModuleGenerator";
import { ModuleSetting } from "../../generators/app/ModuleSetting";

suite(
    "Module-Generator",
    () =>
    {
        let currentDir: string;
        let moduleDir: string;
        let runContext: RunContext;
        let moduleName: string;

        suiteSetup(
            () =>
            {
                currentDir = process.cwd();
                moduleName = "test-module";

                ModuleGenerator.prototype.npmInstall = () =>
                {
                    spawnSync(
                        npmWhich(__dirname).sync("npm"),
                        [
                            "install",
                            "--silent"
                        ],
                        {
                            cwd: moduleDir
                        });
                };

                runContext = run(
                    Path.join(__dirname, "..", "..", "generators", "app")
                ).withPrompts(
                    {
                        [ModuleSetting.Destination]: "./",
                        [ModuleSetting.DisplayName]: moduleName,
                        [ModuleSetting.Name]: moduleName,
                        [ModuleSetting.LintMode]: LintMode.Weak
                    }).withOptions(
                        {
                            "skip-install": false
                        });
            });

        suiteTeardown(
            () =>
            {
                process.chdir(currentDir);
                runContext.cleanTestDirectory();
            });

        test(
            "Checking whether the generator can be executed…",
            async function()
            {
                this.timeout(7 * 60 * 1000);
                this.slow(6.5 * 60 * 1000);
                moduleDir = await runContext.toPromise();
            });

        test(
            "Checking whether the generated module can be installed…",
            async function()
            {
                this.timeout(36 * 1000);
                this.slow(18 * 1000);

                let result = spawnSync(
                    npmWhich(__dirname).sync("npm"),
                    [
                        "install",
                        "--silent"
                    ],
                    {
                        cwd: moduleDir
                    });

                Assert.strictEqual(result.status === 0, true);
            });

        test(
            "Checking whether the generated module can be compiled using typescript…",
            function()
            {
                this.timeout(7.2 * 1000);
                this.slow(3.6 * 1000);

                let result = spawnSync(
                    npmWhich(__dirname).sync("tsc"),
                    [
                        "-p",
                        moduleDir
                    ]);

                Assert.strictEqual(result.status === 0, true);
            });

        test(
            "Checking whether the generated module can be required…",
            () =>
            {
                let test = require(moduleDir);
                Assert.strictEqual(typeof test === "function", true);
            });
    });