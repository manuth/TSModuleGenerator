import { IGeneratorSettings } from "../../IGeneratorSettings";
import { LintMode } from "./LintMode";
import { ModuleSetting } from "./ModuleSetting";

/**
 * Provides settings for the `AppGenerator`.
 */
export interface IModuleSettings extends IGeneratorSettings
{
    /**
     * Gets or sets the human-readable name.
     */
    [ModuleSetting.Name]: string;

    /**
     * Gets or sets the human-readable name.
     */
    [ModuleSetting.DisplayName]: string;

    /**
     * Gets or sets the description.
     */
    [ModuleSetting.Description]: string;

    /**
     * Gets or sets the lint-mode.
     */
    [ModuleSetting.LintMode]: LintMode;
}