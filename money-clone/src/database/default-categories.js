// Default categories seeded on first run, similar to Microsoft Money's defaults.
module.exports = [
  { name: 'Salary', type: 'income' },
  { name: 'Bonus', type: 'income' },
  { name: 'Interest Income', type: 'income' },
  { name: 'Dividend Income', type: 'income' },
  { name: 'Other Income', type: 'income' },

  { name: 'Housing', type: 'expense', children: ['Rent/Mortgage', 'Property Tax', 'Home Insurance', 'Repairs & Maintenance'] },
  { name: 'Utilities', type: 'expense', children: ['Electricity', 'Gas', 'Water', 'Internet', 'Phone'] },
  { name: 'Food', type: 'expense', children: ['Groceries', 'Dining Out', 'Coffee Shops'] },
  { name: 'Transportation', type: 'expense', children: ['Fuel', 'Public Transit', 'Auto Insurance', 'Auto Maintenance', 'Parking'] },
  { name: 'Insurance', type: 'expense', children: ['Health Insurance', 'Life Insurance'] },
  { name: 'Health & Medical', type: 'expense', children: ['Doctor', 'Pharmacy', 'Dental'] },
  { name: 'Entertainment', type: 'expense', children: ['Movies & Shows', 'Streaming Services', 'Hobbies', 'Games'] },
  { name: 'Shopping', type: 'expense', children: ['Clothing', 'Electronics', 'Household Items'] },
  { name: 'Personal Care', type: 'expense', children: [] },
  { name: 'Education', type: 'expense', children: ['Tuition', 'Books & Supplies'] },
  { name: 'Travel', type: 'expense', children: [] },
  { name: 'Gifts & Donations', type: 'expense', children: [] },
  { name: 'Fees & Charges', type: 'expense', children: ['Bank Fees', 'Late Fees', 'Interest Charges'] },
  { name: 'Taxes', type: 'expense', children: ['Federal Tax', 'State Tax'] },
  { name: 'Uncategorized', type: 'expense', children: [] },
];
