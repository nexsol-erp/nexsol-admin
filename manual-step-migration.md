1. update users table of nexsoldb for correct tenancy id
2. remove unwanted data   user_branch_map
    where userid ='6a267788-2552-4321-855c-428852090717' 
    and branchcode in  ('ALL-BRANCH' ,'SATV','WEB-TENANACYID');
    -- For both Franchoisee DB
Only one record exist for one branch user. 
In master tenant DB , remove records for pthr , mlsr and ptpuram
