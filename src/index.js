import { writeFile } from 'node:fs/promises';
import { ApifyClient } from 'apify-client';
import 'dotenv/config';

// Set APIFY_TOKEN in your .env file (copy .env.example to get started)
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// `npm start [keyword] [city] [country] [maxItems]`, e.g. npm start dentist dubai ae 50
const [keyword = 'стоматология', city = 'almaty', country = 'kz', maxItems = '60'] = process.argv.slice(2);

const run = await client.actor('piotrv1001/2gis-scraper').call(
    { searchQueries: [keyword], city, country, maxItems: Number(maxItems), includeContacts: true },
    { log: null },
);
console.log(`Run ${run.status}: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

// Contact coverage differs by market (WhatsApp vs Telegram vs email), so check it before planning outreach.
const count = (has) => items.filter(has).length;
console.log(`\n${items.length} places for "${keyword}" in ${city}`);
console.table({
    phone: count((p) => p.phones?.length),
    email: count((p) => p.emails?.length),
    website: count((p) => p.websites?.length),
    whatsapp: count((p) => p.socials?.whatsapp),
    telegram: count((p) => p.socials?.telegram),
    instagram: count((p) => p.socials?.instagram),
});

// One row per branch, best-reviewed first, first contact of each kind in its own column.
const columns = ['name', 'orgName', 'branchCount', 'district', 'address', 'rating', 'reviewCount', 'phone', 'email', 'website', 'whatsapp', 'telegram', 'instagram', 'url'];
const rows = [...items]
    .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .map((p) => ({
        ...p,
        phone: p.phones?.[0],
        email: p.emails?.[0],
        website: p.websites?.[0],
        whatsapp: p.socials?.whatsapp?.[0],
        telegram: p.socials?.telegram?.[0],
        instagram: p.socials?.instagram?.[0],
    }));
const cell = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n');
// The byte-order mark makes Excel read the file as UTF-8, so Cyrillic and Arabic names survive.
await writeFile('leads.csv', `﻿${csv}\n`);
console.log(`Saved ${rows.length} rows to leads.csv`);
