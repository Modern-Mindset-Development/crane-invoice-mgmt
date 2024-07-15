// Constants {{{
const HEADERS = {
    'QB-Realm-Hostname': 'veterancrane',
    'User-Agent': 'Veteran Crane Invoice Editor',
    'Content-Type': 'application/json'
}
const URLPARAMS = new URLSearchParams(window.location.search);
const OVERRIDE = "QB-USER-TOKEN b8mgn8_p7mc_0_dcagszukpzu85cpxxn44bvvqrva"
const SCHEMA = {
    'Invoices': {
        'id': 'bsg43ze29'
    },
    'Activities': {
        'id': 'bsgtctjng'
    },
    'Employees': {
        'id': 'bsext97t8'
    },
    'Lines': {
        'id': 'bsgtcuxt6'
    }
}
const LINEFIELDS = {
    "#line-date": 11,
    "#line-activity": 6,
    "#line-description": 19,
    "#line-group": 6,
    "#line-price": 18,
    "#line-vendor-price": 31,
    "#line-qty": 12,
    "#line-target-margin": 32,
}
// }}}
// Global Variables {{{
let invoice = URLPARAMS.get('invoice');
let grid;
let data;
// }}}


// Initialization {{{
function startup() {
    showPage("loading");
    getActivities()
        .then(res => loadGridEditor())
        .then(res => {if(invoice) {getInvoiceInfo();getLines()}})
        .then(res => showPage("grid-editor"));
}
// }}}

// Show/hide functionality {{{
function showClassElt(className, id) {
    $("."+className).each(function () {
        $(this).hide();
        if($(this).attr("id") == id) {$(this).show()}
    });
}

function showEditExpense(id) {
    showPage("edit-expense")
    $("#expense-form")[0].reset()
    if(id) {
        showPage("loading");
        getExpense(id).then(res => showPage("edit-expense"));
        expenseId = id;
    }
}

function showPage(newPage) {showClassElt("page", newPage)}
// }}}

// Invoice Selection {{{
function loadInvoiceSelect() {
    showPage("loading");
    getInvoices()
        .then(res => showPage("invoice-select"))
}
function invoiceSearch(input_tag, list_tag) {
    // Declare variables
    var input, filter, ul, li, a, i, txtValue;
    input = $(`#${input_tag}`);
    filter = input.val().toUpperCase();
    ul = $(`#${list_tag}`);
    li = ul.children('li');

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        txtValue = li[i].textContent || li[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

function getInvoices() {
    return queryQuickbase({
        "from": SCHEMA["Invoices"]["id"],
        "select": [3,20]
    }).then(resj => handleInvoices(resj["data"]));
}
function handleInvoices(res) {
    let invoicesLst = $("#invoice-list");

    invoicesLst.empty();
    for(let i = 0; i < res.length; i++) {
        let invoiceOpt = $("<li></li>");
        invoiceOpt.val(res[i][3]["value"]);
        invoiceOpt.text(res[i][20]["value"]);

        invoiceOpt.click(() => {
            invoice = res[i][3]["value"];
            showPage("loading")
            getLines().then(res => showPage("grid-editor"));
        });

        invoicesLst.append(invoiceOpt)
    }
}

function getInvoiceInfo() {
    return queryQuickbase({
        "from": SCHEMA["Invoices"]["id"],
        "select": [20],
        "where": `{3.EX.${invoice}}`,
    }).then(resj => {handleInvoiceInfo(resj["data"])});
}
function handleInvoiceInfo(res) {
    $("#invoice-name").text(res[0][20]["value"]);
}

// }}}

// Grid Editor {{{
function loadGridEditor() {
    grid = new gridjs.Grid({ 
        columns: [
            {name:'Date', width: "200px"}, 
            {name:'Activity', width:"200px"}, 
            {name:'Description', width:"300px"},
            {name:'Line #'},
            {name:'Price', width:"100px"},
            {name:'Vendor Price'},
            {name:'QTY', width:"100px"},
            {name:'Target Margin', width:"200px", footer: (column) => column.reduce((acc, curr) => acc + curr.value, 0)},
        ],
        data: [['1']],
        resizable: true,
        autoWidth: true,
        fixedHeader: true,
        style: {
        },
    });
    document.getElementById("grid-edit-table").addEventListener("input", function() {
        console.log("input event fired");
    }, false);

    grid.render(document.getElementById('grid-edit-table'));
}

const names = ["Date", "Activity", "Description", "Line #","Price","Vendor Price", "QTY","Target Margin"]
const fields = [11,7,21,24,20,31,12,32]

function getLines() {
    return queryQuickbase({
        "from": SCHEMA["Lines"]["id"],
        "select": fields,
        "where": `{15.EX.${invoice}}`
    }).then(resj => {handleLines(resj["data"])})
}

function handleLines(resj) {
    let list = [];
    for(let i = 0; i<resj.length; i++) {
        list.push(fields.map((field) => gridjs.html(`<div contenteditable>${resj[i][field]["value"]}</div>`)))
    }
    data = list;
    grid.updateConfig({ data: list }).forceRender();
}

function updateSummary() {
    console.log(fields.reduce((acc, elt) => acc + data[7][elt]))
}


//}}}


// Line Editing {{{
function addLine() {
    let record = {};

    if(expenseId) {
        record["3"] = {"value": expenseId}; // Record ID to modify if applicable
    }

    record["28"] = {"value": invoice}
    record["29"] = {"value": order}
    record["30"] = {"value": employee}
    for(const prop in elt_lookup) {
        record[elt_lookup[prop]] = {"value": $(prop).val()}
    }

    return addRecord(SCHEMA["Lines"]["id"], record)
        .then(res => res.json())
        .then(res => addDocument(res["metadata"]["createdRecordIds"][0]))
        .then(res => {$("#modify-form")[0].reset()})
        .then(res => showPage('success'));
}

function getActivities() {
    return queryQuickbase({
        "from": SCHEMA["Activities"]["id"],
        "select": [3,6],
        "where": "{16.EX.1}"
    }).then(resj => {handleActivities(resj["data"])})
}
function handleActivities(resj) {
    for(var i=0; i<resj.length; i++) {
        var opt = document.createElement("option");
        opt.value = resj[i][3]["value"];
        opt.innerHTML = resj[i][6]["value"];
        $("#activities").append(opt);
    }
}

// }}}

// Quickbase Interface {{{

function addRecord(table, record_data) {
    showPage("loading");
    return authenticatedInstance(table, (key) => {
        let headers = HEADERS;
        headers["Authorization"] = key;

        let body = {
            "to": table,
            "data": [record_data]
        }
        return fetch("https://api.quickbase.com/v1/records", {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        })
    });
}

function queryQuickbase(body) {
    // General query function for quickbase
    return authenticatedInstance(body["from"], (key) => {
        let headers = HEADERS;
        headers["Authorization"] = key;

        return fetch("https://api.quickbase.com/v1/records/query", {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }).then(res => res.json());
    })
}

function authenticatedInstance(table_id, fun) {
    // Wraps the given function with a temporary authentication key
    if(OVERRIDE) {
        return fun(OVERRIDE);
    }
    return fetch('https://api.quickbase.com/v1/auth/temporary/'+table_id,
        {
            method: 'GET',
            headers: HEADERS,
            credentials: 'include'
        })
        .then(res => res.json())
        .then(resj => fun("QB-TEMP-TOKEN " + resj["temporaryAuthorization"]));
}
// }}}

// Other helpers {{{
function toIsoString(date) {
    let pad = function(num) {
        return (num < 10 ? '0' : '') + num;
    };
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds());
}

function redirect() {
    window.location.replace("https://lift.quickbase.com/db/bt5ywn6kq/");
}
//}}}
