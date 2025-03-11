import csv

# Define the target CSV header for the output.
# (Adjust this list as needed to include all desired fields.)
TARGET_HEADER = [
    "Question",
    "Response",
    "Total",
    "Overall",
    "country_US",
    "country_United_Kingdom",
    "country_India",
    "country_France",
    "country_Germany",
    "country_Japan",
    "country_United_Arab_Emirates",  # In survey 1 these were combined but now separated.
    "country_Brazil",
    "country_Saudi_Arabia",
    "country_Australia",
    "age_18-24",
    "age_25-34",
    "age_35-44",
    "age_45-54",
    "age_55-65",
    "age_65_plus",
    "Gen_Z",
    "Millennials",
    "Gen_X",
    "Baby_Boomers",
    "gender_female",
    "gender_male",
    "org_size_<10",
    "org_size_10-49",
    "org_size_50-99",
    "org_size_100-500",
    "org_size_501-1000",
    "org_size_1000+",
    "employment_status_full-time",
    "employment_status_part-time",
    "employment_status_contract",
    "employment_status_freelance",
    # … Add additional fields for sectors, job levels, education, etc.
]

# Mapping dictionary from the CSV input column names (as they appear in the input file)
# to the target header names. (Modify as needed.)
mapping = {
    "Total": "Total",
    "Overall": "Overall",
    "US": "country_US",
    "United Kingdom": "country_United_Kingdom",
    "India": "country_India",
    "France": "country_France",
    "Germany": "country_Germany",
    "Japan": "country_Japan",
    "United Arab Emirates": "country_United_Arab_Emirates",
    "Brazil": "country_Brazil",
    "Saudi Arabia": "country_Saudi_Arabia",
    "Australia": "country_Australia",
    "18-24": "age_18-24",
    "25-34": "age_25-34",
    "35-44": "age_35-44",
    "45-54": "age_45-54",
    "55-65": "age_55-65",
    "65 plus": "age_65_plus",
    "Gen Z": "Gen_Z",
    "Millennials": "Millennials",
    "Gen X": "Gen_X",
    "Baby Boomers": "Baby_Boomers",
    "Female": "gender_female",
    "Male": "gender_male",
    "<10": "org_size_<10",
    "'10-49": "org_size_10-49",
    "50-99": "org_size_50-99",
    "100-500": "org_size_100-500",
    "501-1000": "org_size_501-1000",
    "1000+": "org_size_1000+",
    "Full Time": "employment_status_full-time",
    "Part Time": "employment_status_part-time",
    "Contract": "employment_status_contract",
    "Freelance": "employment_status_freelance",
    # Continue mapping for sectors, job levels, etc.
}

# Names for input and output files
input_file = "q1_data.csv"
output_file = "q1_mapped.csv"

# Open the input CSV.
with open(input_file, mode="r", newline="", encoding="utf-8") as infile:
    reader = csv.reader(infile)
    
    # Extract the question text from the first cell of the first row.
    first_row = next(reader)
    question_text = first_row[0].strip()
    
    # The second row is assumed to be the header row for the data.
    input_header = next(reader)
    
    # Create a DictReader for the remaining rows using the input header.
    dict_reader = csv.DictReader(infile, fieldnames=input_header)
    
    # Prepare a list to hold mapped rows.
    mapped_rows = []
    
    for row in dict_reader:
        # Create a new row dictionary with keys from TARGET_HEADER,
        # initializing every field to an empty string.
        new_row = {field: "" for field in TARGET_HEADER}
        
        # Set the question text and response.
        new_row["Question"] = question_text
        # The "Response" field will be taken from the first column of the input header.
        first_input_col = input_header[0]
        new_row["Response"] = row.get(first_input_col, "").strip()
        
        # Map each input column (if found in our mapping) to the target field.
        for col_name, value in row.items():
            target_field = mapping.get(col_name)
            if target_field:
                new_row[target_field] = value.strip()
        
        mapped_rows.append(new_row)

# Write the mapped rows into the output CSV.
with open(output_file, mode="w", newline="", encoding="utf-8") as outfile:
    writer = csv.DictWriter(outfile, fieldnames=TARGET_HEADER)
    writer.writeheader()
    for row in mapped_rows:
        writer.writerow(row)

print(f"Mapping complete. Mapped data written to {output_file}")
