# Data dictionary

`data/blinkit_sales.csv` contains **8,500 fully synthetic transaction rows** created for this portfolio project. It does not contain real Blinkit, customer, order, outlet, or product data.

| Column | Type | Description | Example |
|---|---|---|---|
| `order_id` | Text | Unique synthetic transaction identifier | `BLK-ORD-00001` |
| `order_date` | Date | Transaction date in ISO format | `2024-01-01` |
| `outlet_id` | Text | Synthetic outlet identifier | `BLK-OUT-004` |
| `outlet_location_type` | Text | Market tier: Tier 1, 2, or 3 | `Tier 2` |
| `outlet_size` | Text | Outlet footprint: Small, Medium, or High | `Medium` |
| `outlet_type` | Text | Retail format assigned to the outlet | `Supermarket Type1` |
| `outlet_establishment_year` | Whole number | Synthetic outlet opening year | `2012` |
| `item_id` | Text | Synthetic product identifier | `BLK-ITM-0274` |
| `item_type` | Text | Product category | `Fruits and Vegetables` |
| `item_fat_content` | Text | Normalized fat-content grouping | `Low Fat` |
| `item_weight_kg` | Decimal | Catalog item weight in kilograms | `1.25` |
| `item_visibility` | Decimal | Synthetic shelf/app visibility index (0–0.30) | `0.0842` |
| `item_mrp` | Decimal | Synthetic list price in INR | `142.50` |
| `units_sold` | Whole number | Units in the transaction | `2` |
| `sales` | Decimal | Modeled transaction sales in INR | `275.18` |
| `rating` | Decimal | Synthetic customer rating from 2.8 to 5.0 | `4.3` |
| `customer_type` | Text | Relationship segment | `Member` |

## Modeling notes

- One row represents one synthetic order line and each `order_id` is unique.
- Dates cover 1 January 2024 through 31 December 2025.
- Sales are modeled from MRP, quantity, seasonality, weekend effects, outlet demand, customer segment, and bounded random noise.
- Dataset generation is deterministic: running `python scripts/generate_data.py` uses seed `20250814` and reproduces the same CSV.
- The Power Query sample adds `order_year`, `order_month`, and `outlet_age_years` during transformation; these are not stored in the raw CSV.

