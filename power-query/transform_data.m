let
    Source = Csv.Document(
        File.Contents("data/blinkit_sales.csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    TypedColumns = Table.TransformColumnTypes(
        PromotedHeaders,
        {
            {"order_id", type text},
            {"order_date", type date},
            {"outlet_id", type text},
            {"outlet_location_type", type text},
            {"outlet_size", type text},
            {"outlet_type", type text},
            {"outlet_establishment_year", Int64.Type},
            {"item_id", type text},
            {"item_type", type text},
            {"item_fat_content", type text},
            {"item_weight_kg", type number},
            {"item_visibility", type number},
            {"item_mrp", Currency.Type},
            {"units_sold", Int64.Type},
            {"sales", Currency.Type},
            {"rating", type number},
            {"customer_type", type text}
        },
        "en-IN"
    ),
    TrimmedText = Table.TransformColumns(
        TypedColumns,
        List.Transform(
            Table.ColumnsOfType(TypedColumns, {type text}),
            each {_, Text.Trim, type text}
        )
    ),
    StandardizedFatContent = Table.TransformColumns(
        TrimmedText,
        {{"item_fat_content", each if Text.Lower(_) = "low fat" then "Low Fat" else "Regular", type text}}
    ),
    RemovedInvalidRows = Table.SelectRows(
        StandardizedFatContent,
        each [order_id] <> null and [order_date] <> null and [sales] > 0 and [units_sold] > 0
    ),
    AddedOrderYear = Table.AddColumn(RemovedInvalidRows, "order_year", each Date.Year([order_date]), Int64.Type),
    AddedOrderMonth = Table.AddColumn(AddedOrderYear, "order_month", each Date.StartOfMonth([order_date]), type date),
    AddedOutletAge = Table.AddColumn(
        AddedOrderMonth,
        "outlet_age_years",
        each Date.Year(Date.From(DateTime.LocalNow())) - [outlet_establishment_year],
        Int64.Type
    ),
    RemovedDuplicates = Table.Distinct(AddedOutletAge, {"order_id"}),
    SortedRows = Table.Sort(RemovedDuplicates, {{"order_date", Order.Ascending}, {"order_id", Order.Ascending}})
in
    SortedRows

