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
let changes = [];
let subtotals;
let data;
// }}}


// Initialization {{{
function startup() {
    showPage("loading");
    getActivities()
        .then(res => {if(invoice) {getInvoiceInfo();loadEditor()} else {loadInvoiceSelect()}})
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
            loadEditor();
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
const fields = [3,11,7,19,24,18,31,12,32]
let field_names = [];

function loadEditor() {
    showPage("loading")
    getLines().then(res => showPage("grid-editor"))
}

function getLines() {
    return queryQuickbase({
        "from": SCHEMA["Lines"]["id"],
        "select": fields,
        "where": `{15.EX.${invoice}}`
    }).then(resj => {handleLines(resj)})
}

function handleLines(resj) {
    let table = document.getElementById("grid-edit-table")
    table.innerHTML = ""

    data = resj["data"].map(record => {return fields.map(field => record[field]["value"])})

    field_names = resj['fields'].map(field => field["label"])
    let list = [];

    header_row = document.createElement("tr") 
    for(let j = 1; j<field_names.length; j++) {
        let new_header = document.createElement("th")
        new_header.textContent = field_names[j]
        header_row.append(new_header)
    }

    st_header = document.createElement("th")
    st_header.textContent = "Subtotal"
    header_row.append(st_header)

    table.append(header_row)

    for (let i = 0; i < data.length; i++) {
        let row = document.createElement("tr")
        for(let j = 1; j<field_names.length; j++) {
            new_cell = document.createElement("td")
            new_cell.setAttribute("contenteditable", "")
            new_cell.id = `${i}-${j}`
            new_cell.textContent = data[i][j]
            row.append(new_cell)
        }

        new_cell = document.createElement("td")
        new_cell.id = `${i}-subtotal`
        new_cell.textContent = data[i][5]*data[i][7]
        row.append(new_cell)

        table.append(row)
    }

    summary_row = document.createElement("tr") 
    summary_row.id = "summary-row";
    for(let j = 1; j<field_names.length; j++) {
        let new_sum = document.createElement("td")
        new_sum.textContent = "-"
        new_sum.id = `summary-${j}`
        summary_row.append(new_sum)
    }

    new_sum = document.createElement("td")
    new_sum.textContent = "-"
    new_sum.id = "grand-total"
    summary_row.append(new_sum)

    table.append(summary_row)

    document.getElementById("grid-edit-table").addEventListener('input', updateCell);
    
    for(let i=0; i<field_names.length; i++) {
        updateSummary(i)
    }

    subtotals = new Array(data.length)
    for(let i=0; i<data.length; i++) {
        updateSubtotal(i)
    }
}

function updateCell(event) {
    let cell = event.target
    const rowIndex = cell.id.split("-")[0]; // Adjust for header row
    const colIndex = cell.id.split("-")[1];
    const newVal = parseFloat(cell.textContent)
    data[rowIndex][colIndex] = newVal
    updateSummary(rowIndex, colIndex);
    updateSubtotal(rowIndex);

    addChange(rowIndex, colIndex, newVal)
}

function updateSummary(rowIndex, colIndex) { 
    if(field_names[colIndex]=="Edit Price") {
        sum = data.reduce((acc, elt) => acc + elt[colIndex], 0)
        document.getElementById(`summary-${colIndex}`).textContent = sum
    }
}

function updateSubtotal(rowIndex) { 
    subtotals[rowIndex] = data[rowIndex][5] * data[rowIndex][7]
    document.getElementById(`${rowIndex}-subtotal`).textContent = subtotals[rowIndex]

    grandTotal = subtotals.reduce((acc,elt) => acc + elt, 0)
    document.getElementById(`grand-total`).textContent = grandTotal
}

function addChange(rowIndex, colIndex, newVal) {
    let field = fields[colIndex]
    let record_id = data[rowIndex][0]
    let change = {}

    index = changes.findIndex(change => change[3]["value"] == record_id)
    if(index == -1) {
        index = changes.length
        changes.push({3: {"value": record_id}})
    }
    changes[index][field] = {}
    changes[index][field]["value"] = newVal
}

function saveData() {
    addRecords(SCHEMA["Lines"]["id"], changes)
}

//}}}


// Activities {{{
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

function addRecords(table, record_data) {
    showPage("loading");
    return authenticatedInstance(table, (key) => {
        let headers = HEADERS;
        headers["Authorization"] = key;

        let body = {
            "to": table,
            "data": record_data
        }
        return fetch("https://api.quickbase.com/v1/records", {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }).then(res => showPage("success"));
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
    window.location.replace(`https://veterancrane.quickbase.com/db/bsg43ze29/form?a=dr&rid=${invoice}&rl=dmv&page=1`);
}
//}}}
