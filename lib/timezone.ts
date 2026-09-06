import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const APP_TIME_ZONE = 'Europe/Istanbul';

/** Return the start of the current calendar day in the product's timezone. */
export function getAppDayStart(now = new Date()): Date {
    const day = formatInTimeZone(now, APP_TIME_ZONE, 'yyyy-MM-dd');
    return fromZonedTime(`${day}T00:00:00`, APP_TIME_ZONE);
}

/** Format an instant as the product's local calendar date. */
export function formatAppDate(value: Date | string): string {
    return formatInTimeZone(new Date(value), APP_TIME_ZONE, 'yyyy-MM-dd');
}
