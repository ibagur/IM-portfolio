#!/usr/bin/env python3
import csv
import json
from collections import defaultdict

# Read the CSV file
csv_path = 'data/WASH_partner_locations_with_coordinates.csv'

# Read data
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    data = list(reader)

print(f"Loaded {len(data)} records")

# Group by location
location_data = defaultdict(lambda: {'partners': [], 'coords': None})

for row in data:
    location = row['Location']
    partner = row['Development Partners']
    water_truck = row['Water Trucking/Distribution'] == 'Y'
    water_treat = row['Water Treatment'] == 'Y'

    # Build activities list
    activities = []
    if water_truck:
        activities.append('Water Trucking/Distribution')
    if water_treat:
        activities.append('Water Treatment')

    # Parse coordinates - simple split on comma
    coords = row['Coordinates'].split(',')
    lat = float(coords[0].strip())
    lon = float(coords[1].strip())

    # Store coordinates (use first valid one found for this location)
    if location_data[location]['coords'] is None:
        location_data[location]['coords'] = (lat, lon)

    # Check if partner already exists for this location
    existing_partner = None
    for p in location_data[location]['partners']:
        if p['name'] == partner:
            existing_partner = p
            break

    if existing_partner:
        # Merge activities
        for act in activities:
            if act not in existing_partner['activities']:
                existing_partner['activities'].append(act)
    else:
        # Add new partner
        if activities:
            location_data[location]['partners'].append({
                'name': partner,
                'activities': activities
            })

# Build JavaScript array
locations = []
for location, info in sorted(location_data.items()):
    if info['coords'] is None:
        print(f"WARNING: No valid coordinates for {location}")
        continue

    lat, lon = info['coords']

    locations.append({
        'location': location,
        'lat': lat,
        'lon': lon,
        'partner_count': len(info['partners']),
        'partners': info['partners']
    })

# Output as JavaScript
print(f"\nProcessed {len(locations)} unique locations")
print(f"Total partner entries: {sum(loc['partner_count'] for loc in locations)}")
print("\n" + json.dumps(locations))
