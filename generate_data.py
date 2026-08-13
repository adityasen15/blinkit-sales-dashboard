"""Generate the deterministic synthetic dataset used by the dashboard.

The project is a portfolio demonstration and is not affiliated with Blinkit.
All rows produced by this script are artificial.
"""

from __future__ import annotations

import csv
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path


SEED = 20250814
ROW_COUNT = 8_500


@dataclass(frozen=True)
class Outlet:
    outlet_id: str
    location_type: str
    size: str
    outlet_type: str
    establishment_year: int
    demand_factor: float


OUTLETS = (
    Outlet("BLK-OUT-001", "Tier 1", "High", "Supermarket Type1", 2011, 1.23),
    Outlet("BLK-OUT-002", "Tier 1", "Medium", "Supermarket Type2", 2015, 1.15),
    Outlet("BLK-OUT-003", "Tier 1", "Medium", "Grocery Store", 2018, 1.07),
    Outlet("BLK-OUT-004", "Tier 2", "High", "Supermarket Type1", 2012, 1.16),
    Outlet("BLK-OUT-005", "Tier 2", "Medium", "Supermarket Type2", 2016, 1.08),
    Outlet("BLK-OUT-006", "Tier 2", "Small", "Grocery Store", 2020, 0.94),
    Outlet("BLK-OUT-007", "Tier 2", "Small", "Supermarket Type1", 2019, 1.00),
    Outlet("BLK-OUT-008", "Tier 3", "High", "Supermarket Type3", 2010, 1.05),
    Outlet("BLK-OUT-009", "Tier 3", "Medium", "Supermarket Type2", 2017, 0.96),
    Outlet("BLK-OUT-010", "Tier 3", "Small", "Grocery Store", 2021, 0.84),
    Outlet("BLK-OUT-011", "Tier 3", "Small", "Supermarket Type1", 2022, 0.88),
)


# item type, catalog share, MRP range, typical weight (kg), low-fat probability
ITEM_PROFILES = (
    ("Fruits and Vegetables", 17, (24, 210), (0.20, 5.00), 0.94),
    ("Snack Foods", 14, (18, 260), (0.04, 1.00), 0.30),
    ("Household", 11, (45, 620), (0.10, 5.00), 0.96),
    ("Frozen Foods", 9, (55, 420), (0.15, 2.00), 0.45),
    ("Dairy", 9, (28, 330), (0.10, 2.00), 0.55),
    ("Canned", 7, (35, 285), (0.10, 1.20), 0.62),
    ("Baking Goods", 7, (30, 310), (0.05, 2.00), 0.48),
    ("Health and Hygiene", 6, (35, 750), (0.05, 1.50), 0.92),
    ("Soft Drinks", 6, (20, 180), (0.18, 2.50), 0.70),
    ("Meat", 5, (90, 680), (0.20, 2.50), 0.35),
    ("Breads", 4, (25, 145), (0.15, 0.80), 0.65),
    ("Breakfast", 3, (45, 390), (0.10, 1.50), 0.52),
    ("Seafood", 2, (120, 850), (0.20, 2.00), 0.61),
)


def weighted_choice(rng: random.Random, values: list, weights: list[float]):
    return rng.choices(values, weights=weights, k=1)[0]


def build_catalog(rng: random.Random, size: int = 920) -> list[dict]:
    types = [profile[0] for profile in ITEM_PROFILES]
    weights = [profile[1] for profile in ITEM_PROFILES]
    profile_by_type = {profile[0]: profile for profile in ITEM_PROFILES}
    catalog: list[dict] = []

    for number in range(1, size + 1):
        item_type = weighted_choice(rng, types, weights)
        _, _, mrp_range, weight_range, low_fat_probability = profile_by_type[item_type]
        # Triangular pricing creates a believable long tail without extreme outliers.
        item_mrp = round(rng.triangular(mrp_range[0], mrp_range[1], mrp_range[0] * 1.45), 2)
        item_weight = round(rng.uniform(*weight_range), 2)
        fat_content = "Low Fat" if rng.random() < low_fat_probability else "Regular"
        visibility = round(min(0.30, rng.betavariate(2.1, 16.0)), 4)
        catalog.append(
            {
                "item_id": f"BLK-ITM-{number:04d}",
                "item_type": item_type,
                "item_fat_content": fat_content,
                "item_weight_kg": item_weight,
                "item_visibility": visibility,
                "item_mrp": item_mrp,
            }
        )
    return catalog


def generate_rows(rng: random.Random) -> list[dict]:
    catalog = build_catalog(rng)
    start = date(2024, 1, 1)
    end = date(2025, 12, 31)
    day_count = (end - start).days + 1
    outlet_weights = [outlet.demand_factor for outlet in OUTLETS]
    # Catalog purchase probability varies mildly, so popular products repeat more often.
    item_weights = [rng.uniform(0.55, 1.65) for _ in catalog]
    rows: list[dict] = []

    for index in range(1, ROW_COUNT + 1):
        order_date = start + timedelta(days=rng.randrange(day_count))
        outlet = weighted_choice(rng, list(OUTLETS), outlet_weights)
        item = weighted_choice(rng, catalog, item_weights)

        customer_type = weighted_choice(
            rng,
            ["Member", "Returning", "New"],
            [46, 34, 20],
        )
        units = weighted_choice(rng, [1, 2, 3, 4, 5], [58, 27, 10, 4, 1])
        month_factor = {
            1: 0.96,
            2: 0.95,
            3: 1.00,
            4: 1.02,
            5: 1.04,
            6: 1.01,
            7: 0.99,
            8: 1.03,
            9: 1.06,
            10: 1.13,
            11: 1.10,
            12: 1.16,
        }[order_date.month]
        weekend_factor = 1.04 if order_date.weekday() >= 5 else 1.0
        loyalty_factor = {"Member": 0.94, "Returning": 0.97, "New": 1.0}[customer_type]
        demand_noise = rng.uniform(0.94, 1.06)
        gross_sales = (
            item["item_mrp"]
            * units
            * month_factor
            * weekend_factor
            * loyalty_factor
            * demand_noise
        )
        sales = round(gross_sales, 2)
        rating_mean = 4.18 + (0.06 if customer_type == "Member" else 0)
        rating = round(max(2.8, min(5.0, rng.gauss(rating_mean, 0.43))), 1)

        rows.append(
            {
                "order_id": f"BLK-ORD-{index:05d}",
                "order_date": order_date.isoformat(),
                "outlet_id": outlet.outlet_id,
                "outlet_location_type": outlet.location_type,
                "outlet_size": outlet.size,
                "outlet_type": outlet.outlet_type,
                "outlet_establishment_year": outlet.establishment_year,
                **item,
                "units_sold": units,
                "sales": f"{sales:.2f}",
                "rating": f"{rating:.1f}",
                "customer_type": customer_type,
            }
        )

    rows.sort(key=lambda row: (row["order_date"], row["order_id"]))
    return rows


def validate(rows: list[dict]) -> None:
    assert len(rows) == ROW_COUNT
    assert len({row["order_id"] for row in rows}) == ROW_COUNT
    assert all(float(row["sales"]) > 0 for row in rows)
    assert all(1 <= int(row["units_sold"]) <= 5 for row in rows)
    assert all(1 <= float(row["rating"]) <= 5 for row in rows)
    assert {row["outlet_id"] for row in rows} == {outlet.outlet_id for outlet in OUTLETS}


def main() -> None:
    rng = random.Random(SEED)
    rows = generate_rows(rng)
    validate(rows)
    output = Path(__file__).resolve().parents[1] / "data" / "blinkit_sales.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    total_sales = sum(float(row["sales"]) for row in rows)
    total_units = sum(int(row["units_sold"]) for row in rows)
    print(f"Wrote {len(rows):,} synthetic rows to {output}")
    print(f"Sales={total_sales:.2f}; Units={total_units:,}; Seed={SEED}")


if __name__ == "__main__":
    main()
