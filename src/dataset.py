"""
This project processes data from TruthfulQA dataset
Source: https://github.com/sylinrl/TruthfulQA (Apache-2.0)
"""

def filter_truthfulqa_data(pd):
    """
    Filter TruthfulQA dataset for specific type-category combinations
    
    Args:
        pd: pandas module (already imported in main file)
    
    Returns:
        pandas.DataFrame: Filtered dataset
    """
    
    # Load data
    df = pd.read_csv('https://raw.githubusercontent.com/sylinrl/TruthfulQA/main/TruthfulQA.csv')
    
    # Select only needed columns
    columns_needed = ['Type', 'Category', 'Question', 'Correct Answers', 'Source']
    df_filtered = df[columns_needed].copy()
    
    # Define desired type-category combinations
    adversarial_categories = [
        'Misconceptions',
        'Health', 
        'Nutrition'
    ]
    
    non_adversarial_categories = [
        'Confusion: Places',
        'Confusion: Other',
        'Health',
        'Weather',
        'Statistics',
        'Nutrition',
        'History',
        'Logical Falsehood'
    ]
    
    # Empty list for filtered data
    filtered_data = []
    
    # Adversarial: 3 entries per category
    for category in adversarial_categories:
        subset = df_filtered[
            (df_filtered['Type'] == 'Adversarial') & 
            (df_filtered['Category'] == category)
        ].head(3)
        filtered_data.append(subset)
        # print(f"Adversarial {category}: {len(subset)} entries found")
    
    # Non-Adversarial: 5 entries per category  
    for category in non_adversarial_categories:
        subset = df_filtered[
            (df_filtered['Type'] == 'Non-Adversarial') & 
            (df_filtered['Category'] == category)
        ].head(5)
        filtered_data.append(subset)
        print(f"Non-Adversarial {category}: {len(subset)} entries found")
    
    # Combine all filtered data
    final_dataset = pd.concat(filtered_data, ignore_index=True)
        
    return final_dataset