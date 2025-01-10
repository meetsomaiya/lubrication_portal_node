// server.js
const express = require('express');
const morgan = require('morgan');  // Import morgan
const app = express();
const port = process.env.PORT || 3001;

// Middleware to log HTTP requests
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Middleware to parse JSON bodies
// app.use(express.json()); // Uncomment if needed for JSON parsing

// Import routes
const api1 = require('./apis/login2');
const api2 = require('./apis/checkAdmin');
const api3 = require('./apis/get_states');
const api4 = require('./apis/get_areas');
const api5 = require('./apis/get_sites');
const api6 = require('./apis/generate_site_report');
const api7 = require('./apis/fetch_type_order_for_wtg_wise_planning');
const api8 = require('./apis/get_total_wtg_count');
const api9 = require('./apis/get_total_planned_wtg_count');
const api10 = require('./apis/get_total_wtg_planned');
const api11 = require('./apis/get_total_open_status_wtg_count');
const api12 = require('./apis/get_completed_count');
const api13 = require('./apis/get_completed_out_of_grace_count');
const api14 = require('./apis/get_total_wtg_count_based_on_state.js');
const api15 = require('./apis/get_open_status_wtg_data');
const api16 = require('./apis/get_completed_wtg_data');
const api17 = require('./apis/get_completed_out_of_grace_data');
const api18 = require('./apis/get_functional_locations');
const api19 = require('./apis/fetch_schedule_plan_lubrication');

/*user side scripts */
const api20 = require('./apis/checkUser');

/* oil analysis scripts */
const api21 = require('./apis/fetch_fy_year');
const api22 = require('./apis/fetch_order_type');
const api23 = require('./apis/fetch_yd_oil_change_state_wise_data');
const api24 = require('./apis/fetch_pd_oil_change_state_wise_data');
const api25 = require('./apis/fetch_gb_oil_change_state_wise_data');
const api26 = require('./apis/fetch_fc_oil_change_state_wise_data');
const api27 = require('./apis/fetch_gb_topup_state_wise_data');
const api28 = require('./apis/fetch_fc_topup_state_wise_data');
const api29 = require('./apis/fetch_ydpd_topup_state_wise_data');
const api30 = require('./apis/fetch_dispute_state_wise_data');
const api31 = require('./apis/fetch_pending_teco_state_wise_data');
/* internal data for oil analysis */
const api32 = require('./apis/fetch_fc_oil_chg_data');
const api33 = require('./apis/fetch_gb_oil_chg_data');
const api34 = require('./apis/fetch_yd_oil_chg_data');
const api35 = require('./apis/fetch_pd_oil_chg_data');
const api36 = require('./apis/fetch_gb_topup_data');
const api37 = require('./apis/fetch_fc_topup_data');
const api38 = require('./apis/fetch_ydpd_topup_data');
const api39 = require('./apis/fetch_dispute_data');
const api40 = require('./apis/fetch_pending_teco_data');


/* user side scripts for sending data */
const api41 = require('./apis/fetch_fc_oil_chg_data_user');
const api42 = require('./apis/fetch_gb_oil_chg_data_user');
const api43 = require('./apis/fetch_yd_oil_chg_data_user');
const api44 = require('./apis/fetch_pd_oil_chg_data_user');
const api45 = require('./apis/fetch_gb_topup_data_user');
const api46 = require('./apis/fetch_fc_topup_data_user');
const api47 = require('./apis/fetch_ydpd_topup_data_user');
const api48 = require('./apis/fetch_dispute_data_user');
const api49 = require('./apis/fetch_pending_teco_data_user');

/* reason retrieval and insertion for dispute */

const api50 = require('./apis/insert_reason_for_dispute_and_pending_teco');

/* download segregated file */

const api51 = require('./apis/download_segregated_oil_analysis_file');

/* download consolidated file */

const api52 = require('./apis/download_consolidated_file');

const api53 = require('./apis/download_segregated_oil_analysis_file_user');

const api54 = require('./apis/download_consolidated_file_user');

const api55 = require('./apis/insert_reason_for_wtg_planning');

const api56 = require('./apis/logout_admin');

const api57 = require('./apis/toggle_admin');

const api58 = require('./apis/logout_user');

const api59 = require('./apis/register_user');

const api60 = require('./apis/fetch_users');

const api61 = require('./apis/update_user_details');

const api62 = require('./apis/delete_user');

const api63 = require('./apis/register_admin');

const api64 = require('./apis/fetch_admins');

const api65 = require('./apis/delete_admin');

const api66 = require('./apis/fetch_oil_under_supervision');

const api67 = require('./apis/fetch_oil_under_supervision_admin');

const api68 = require('./apis/site_incharge_format_upload');

const api69 = require('./apis/site-incharge-excel-format');

const api70 = require('./apis/register-users-via-excel');

const api71 = require('./apis/user-registration-excel-format');

const api72 = require('./apis/get_planned_wtg_count_based_on_state');

const api73 = require('./apis/get_open_wtg_count_based_on_state');

const api74 = require('./apis/get_completed_wtg_count_based_on_state');

const api75 = require('./apis/get_completed_out_of_grace_wtg_count_based_on_state');

const api76 = require('./apis/heartbeat');

const api77 = require('./apis/api_for_auto_login');



// Use routes with a dynamic router prefix
app.use('/api/login2', api1);
app.use('/api/checkAdmin', api2);
app.use('/api/get_states', api3);
app.use('/api/get_areas', api4);
app.use('/api/get_sites', api5);
app.use('/api/generate_site_report', api6);
app.use('/api/fetch_type_order_for_wtg_wise_planning', api7);
app.use('/api/get_total_wtg_count', api8);
app.use('/api/get_total_planned_wtg_count', api9);
app.use('/api/get_total_wtg_planned', api10);
app.use('/api/get_total_open_status_wtg_count', api11);
app.use('/api/get_completed_count', api12);
app.use('/api/get_completed_out_of_grace_count', api13);
app.use('/api/get_total_wtg_count_based_on_state', api14);
app.use('/api/get_open_status_wtg_data', api15);
app.use('/api/get_completed_wtg_data', api16);
app.use('/api/get_completed_out_of_grace_data', api17);
app.use('/api/get_functional_locations', api18);
app.use('/api/fetch_schedule_plan_lubrication', api19);

/* user side scripts */
app.use('/api/checkUser', api20);

/* oil analysis scripts */
app.use('/api/fetch_fy_year', api21);
app.use('/api/fetch_order_type', api22);
app.use('/api/fetch_yd_oil_change_state_wise_data', api23);
app.use('/api/fetch_pd_oil_change_state_wise_data', api24);
app.use('/api/fetch_gb_oil_change_state_wise_data', api25);
app.use('/api/fetch_fc_oil_change_state_wise_data', api26);
app.use('/api/fetch_gb_topup_state_wise_data', api27);
app.use('/api/fetch_fc_topup_state_wise_data', api28);
app.use('/api/fetch_ydpd_topup_state_wise_data', api29);
app.use('/api/fetch_dispute_state_wise_data', api30);
app.use('/api/fetch_pending_teco_state_wise_data', api31);
/* internal data for oil analysis */
app.use('/api/fetch_fc_oil_chg_data', api32);
app.use('/api/fetch_gb_oil_chg_data', api33);
app.use('/api/fetch_yd_oil_chg_data', api34);
app.use('/api/fetch_pd_oil_chg_data', api35);
app.use('/api/fetch_gb_topup_data', api36);
app.use('/api/fetch_fc_topup_data', api37);
app.use('/api/fetch_ydpd_topup_data', api38);
app.use('/api/fetch_dispute_data', api39);
app.use('/api/fetch_pending_teco_data', api40);

/* user sides scripts */

app.use('/api/fetch_fc_oil_chg_data_user', api41);
app.use('/api/fetch_gb_oil_chg_data_user', api42);
app.use('/api/fetch_yd_oil_chg_data_user', api43);
app.use('/api/fetch_pd_oil_chg_data_user', api44);
app.use('/api/fetch_gb_topup_data_user', api45);
app.use('/api/fetch_fc_topup_data_user', api46);
app.use('/api/fetch_ydpd_topup_data_user', api47);
app.use('/api/fetch_dispute_data_user', api48);
app.use('/api/fetch_pending_teco_data_user', api49);

/* reason retrieval and insertion for dispute */

app.use('/api/insert_reason_for_dispute_and_pending_teco', api50);

/* download segregated file */

app.use('/api/download_segregated_oil_analysis_file', api51);

/* download consolidated file */

app.use('/api/download_consolidated_file', api52);

app.use('/api/download_segregated_oil_analysis_file_user', api53);

app.use('/api/download_consolidated_file_user', api54);

app.use('/api/insert_reason_for_wtg_planning', api55);

app.use('/api/logout_admin', api56);

app.use('/api/toggle_admin', api57);

app.use('/api/logout_user', api58);

app.use('/api/register_user', api59);

app.use('/api/fetch_users', api60);

app.use('/api/update_user_details', api61);

app.use('/api/delete_user', api62);

app.use('/api/register_admin', api63);

app.use('/api/fetch_admins', api64);

app.use('/api/delete_admin', api65);

app.use('/api/fetch_oil_under_supervision', api66);

app.use('/api/fetch_oil_under_supervision_admin', api67);

app.use('/api/site_incharge_format_upload', api68);

app.use('/api/site-incharge-excel-format', api69);

app.use('/api/register-users-via-excel', api70);

app.use('/api/user-registration-excel-format', api71);

app.use('/api/get_planned_wtg_count_based_on_state', api72);

app.use('/api/get_open_wtg_count_based_on_state', api73);

app.use('/api/get_completed_wtg_count_based_on_state', api74);

app.use('/api/get_completed_out_of_grace_wtg_count_based_on_state', api75);

app.use('/api/heartbeat', api76);

app.use('/api/api_for_auto_login', api77);





app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
