import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAudioMimeType, getRecordingPath, parseCallDate } from '../lib/call-analysis.ts';

const lead = '12345678-1234-1234-1234-123456789abc';
const origin = 'https://example.supabase.co';
const file = `${lead}-1788540000000.webm`;
const url = `${origin}/storage/v1/object/public/call-recordings/${file}`;

test('accepts this lead recording from configured Supabase storage', () => {
    assert.equal(getRecordingPath(url, lead, origin), file);
});

test('rejects foreign origins, other leads, buckets, redirects and path tricks', () => {
    for (const candidate of [
        url.replace(origin, 'http://127.0.0.1'),
        url.replace(lead, 'aaaaaaaa-1234-1234-1234-123456789abc'),
        url.replace('call-recordings', 'avatars'),
        `${url}?redirect=http://localhost`,
        url.replace(file, `../${file}`),
        url.replace(file, `%2e%2e%2f${file}`),
        url.replace('https://', 'https://user:pass@'),
        'not a URL',
    ]) assert.equal(getRecordingPath(candidate, lead, origin), null, candidate);
});

test('Istanbul callback times are converted consistently to UTC', () => {
    assert.equal(parseCallDate('2026-09-05 14:00').toISOString(), '2026-09-05T11:00:00.000Z');
    assert.equal(Number.isNaN(parseCallDate('tomorrow afternoon').getTime()), true);
});

test('audio MIME is normalized from the trusted storage extension', () => {
    assert.equal(getAudioMimeType('lead-1.webm', 'application/octet-stream'), 'audio/webm');
    assert.equal(getAudioMimeType('lead-1.mp4', 'audio/webm;codecs=opus'), 'audio/mp4');
    assert.equal(getAudioMimeType('lead-1.ogg', null), 'audio/ogg');
    assert.equal(getAudioMimeType('lead-1.mp3', 'application/octet-stream'), 'audio/mpeg');
});
