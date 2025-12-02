/**
 * A class for managing flags that are stored in local storage.
 * Generally used for development purposes only.
 */
export class LocalStorageFlag {
  private value: boolean;

  constructor(
    readonly friendlyName: string,
    readonly devName: string,
    defaultValue: boolean,
  ) {
    const rawValue = typeof localStorage !== 'undefined' ? localStorage.getItem(this.devName) : defaultValue;
    if (rawValue === 'true') {
      this.value = true;
    } else if (rawValue === 'false') {
      this.value = false;
    } else {
      this.value = defaultValue;
    }
  }

  get(): boolean {
    return this.value;
  }

  getLocalStorageValue(): boolean {
    return this.get();
  }

  setLocalStorageValue(newValue: boolean): void {
    this.value = newValue;
    localStorage.setItem(this.devName, this.value ? 'true' : 'false');
  }
}

/** Flags that are stashed in local storage. Use `UserExperimentFlags` for anything used in production */
export const FLAGS = {
  DEV_TOOLS_VISIBLE: new LocalStorageFlag('Dev tools visible', 'dev_tools_visible', true),
};
