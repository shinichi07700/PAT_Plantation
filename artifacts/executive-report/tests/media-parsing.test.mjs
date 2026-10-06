import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function parseDriveMedia(raw) {
  if (!raw) return [];
  const urls = raw.split(/[\s,;]+/).filter((u) => u.trim().startsWith('http'));
  const list = [];

  for (const url of urls) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const id = match[1];
      list.push({
        id,
        originalUrl: url,
        primaryThumb: `https://lh3.googleusercontent.com/d/${id}=w400`,
        secondaryThumb: `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
        previewUrl: `https://lh3.googleusercontent.com/d/${id}=w1600`,
        driveUrl: `https://drive.google.com/file/d/${id}/view`,
      });
    }
  }

  return list;
}

test('parseDriveMedia extracts single and multiple Google Drive file IDs', () => {
  const single = 'https://drive.google.com/file/d/1Wm6sytUn7RAc4zpx4AuanxUpBZpAcoGf/view?usp=drivesdk';
  const res1 = parseDriveMedia(single);
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, '1Wm6sytUn7RAc4zpx4AuanxUpBZpAcoGf');
  assert.equal(res1[0].primaryThumb, 'https://lh3.googleusercontent.com/d/1Wm6sytUn7RAc4zpx4AuanxUpBZpAcoGf=w400');
  assert.equal(res1[0].driveUrl, 'https://drive.google.com/file/d/1Wm6sytUn7RAc4zpx4AuanxUpBZpAcoGf/view');

  const multiple = 'https://drive.google.com/file/d/1XGYBX4Xd0nOYwGsnt_Fpq11DNU-8MPl7/view?usp=drivesdk, https://drive.google.com/file/d/13BmAPyaZMLDaPS3xdvQvytk-Yayr-fCi/view?usp=drivesdk';
  const res2 = parseDriveMedia(multiple);
  assert.equal(res2.length, 2);
  assert.equal(res2[0].id, '1XGYBX4Xd0nOYwGsnt_Fpq11DNU-8MPl7');
  assert.equal(res2[1].id, '13BmAPyaZMLDaPS3xdvQvytk-Yayr-fCi');

  const empty = parseDriveMedia('');
  assert.equal(empty.length, 0);
});

test('public report.json visits contain parsed photoUrl media links', () => {
  const reportData = JSON.parse(fs.readFileSync('artifacts/executive-report/public/data/report.json', 'utf8'));
  assert.ok(reportData.visits.length > 0, 'Visits must not be empty');
  
  const visitsWithPhotos = reportData.visits.filter(v => v.photoUrl);
  assert.ok(visitsWithPhotos.length > 200, `Expected >200 visits with photos, got ${visitsWithPhotos.length}`);

  // Test first visit with photos
  const first = visitsWithPhotos[0];
  const parsed = parseDriveMedia(first.photoUrl);
  assert.ok(parsed.length >= 1, 'First visit should have at least 1 parsed photo');
  assert.ok(parsed[0].primaryThumb.startsWith('https://lh3.googleusercontent.com/d/'));
});
