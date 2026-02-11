# Scratch Data Limits

We should have limits on the number of objects and size of objects, so we can
test against it and validate it works well. These limits can be raised over time.


## Remote Limits

### Tables per Connection
- **Proposed Scratch Limit: 300** — then fail at connection listing time with 'connection has too many tables'
- Returned by the service, mostly informational.
  Not much bigger than per external base actually.
- WS p50: 9 | p90: 41 | p99: 213 | max: 3,846

### Columns per Table
- **Proposed Scratch Limit: 250** — then fail at data folder import time with 'table has too many columns'
- Returned by the service, mostly informational.
- WS p50: 10 | p90: 32 | p99: 114 | max: 1,156

### Records per (Synced) Table
- **Proposed Scratch Limit: 200,000** — then fail at pull time with 'too many records in this table'
- Non-tombstoned EMR count.
- WS p50: 28 | p90: 699 | p99: 11,920 | max: 697,386

### Record Size (KB)
- **Proposed Scratch Limit: 100KB** — then drop record with error
- Raw RemoteData size, same as on-disk file size in git repo.
- WS p50: 1.5KB | p90: 9.1KB | p99: 28.5KB | max: 11.5MB


## Sync Limits

### Mapped Tables per Sync
- **Proposed Scratch Limit: 50** — then UI/validation rejects it
- Not very equivalent to anything in Scratch but interesting.
  In Scratch you can always build multiple syncs?
- WS p50: 1 | p90: 9 | p99: 23 | max: 78

### Mapped Columns per Table
- **Proposed Scratch Limit: 100** — then UI/validation rejects it
- WS p50: 9 | p90: 28 | p99: 68 | max: 438


---


## Test Databases

There are postgres databases prepopulated with just below and just above the limits for testing with. See `create_sample-dbs.sql` to reset and recreate them.

### Table Count
- ✅ At limit (300)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_table_count_at`
- 🚨 Over limit (301)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_table_count_over`

### Column Count
- ✅ At limit (250)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_col_count_at`
- 🚨 Over limit (251)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_col_count_over`

### Record Count
- ✅ At limit (200K)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_record_count_at`
- 🚨 Over limit (200,001)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_record_count_over`

### Record Size
- ✅ At limit (~100KB)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_record_size_at`
- 🚨 Over limit (~105KB)
  `postgresql://postgres:<see 1p>@test-sandbox-db.whalesync.com:5432/test_record_size_over`



