const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_HOUR_MS = ONE_MINUTE_MS * 60;
const ONE_DAY_MS = ONE_HOUR_MS * 24;

export function milliseconds(milliseconds: number): Duration {
  return new Duration(milliseconds);
}

export function seconds(seconds: number): Duration {
  return new Duration(seconds * ONE_SECOND_MS);
}

export function minutes(minutes: number): Duration {
  return new Duration(minutes * ONE_MINUTE_MS);
}

export function hours(hours: number): Duration {
  return new Duration(hours * ONE_HOUR_MS);
}

export function days(days: number): Duration {
  return new Duration(days * ONE_DAY_MS);
}

export function durationSince(date: Date): Duration {
  return new Duration(new Date().getTime() - date.getTime());
}

export class Duration {
  constructor(private readonly _ms: number) {}

  ms(): number {
    return this._ms;
  }

  seconds(): number {
    return this._ms / ONE_SECOND_MS;
  }

  hours(): number {
    return this._ms / ONE_HOUR_MS;
  }

  /** Returns a Date this duration before the provided Date. */
  before(date: Date): Date {
    return new Date(date.getTime() - this._ms);
  }

  /** Returns a Date this duration after the provided Date. */
  after(date: Date): Date {
    return new Date(date.getTime() + this._ms);
  }

  /** Returns a Date this duration in the past. */
  inPast(): Date {
    return this.before(new Date());
  }

  /** Returns a Date this duration in the future. */
  inFuture(): Date {
    return this.after(new Date());
  }

  /** Prints it human readable, with the largest unit, and max 3 decimals */
  toString(): string {
    if (this._ms >= ONE_DAY_MS) {
      return `${(this._ms / ONE_DAY_MS).toFixed(3)}d`;
    } else if (this._ms >= ONE_HOUR_MS) {
      return `${(this._ms / ONE_HOUR_MS).toFixed(3)}h`;
    } else if (this._ms >= ONE_MINUTE_MS) {
      return `${(this._ms / ONE_MINUTE_MS).toFixed(3)}m`;
    } else if (this._ms >= ONE_SECOND_MS) {
      return `${(this._ms / ONE_SECOND_MS).toFixed(3)}s`;
    } else {
      return `${this._ms.toFixed(3)}ms`;
    }
  }
}
