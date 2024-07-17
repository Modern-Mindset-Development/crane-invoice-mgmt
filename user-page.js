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
let nextid = -1;
let subtotals;
let activities= {}
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
const fields = [3,11,6,19,26,18,31,12,32]
const default_vals = [-1,"","","","",0,"",0,0.3]
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

    header_row = table.insertRow()
    for(let j = 1; j<field_names.length; j++) {
        let new_header = document.createElement("th")
        new_header.textContent = field_names[j]
        header_row.append(new_header)
    }

    st_header = document.createElement("th")
    st_header.textContent = "Subtotal"
    header_row.append(st_header)

    del_header = document.createElement("th")
    del_header.textContent = "Delete"
    header_row.append(del_header)

    subtotals = new Array(data.length)
    for (let i = 0; i < data.length; i++) {
        genRow(i)
    }

    summary_row = table.insertRow()
    summary_row.id = "summary-row";
    for(let j = 1; j<field_names.length; j++) {
        let new_sum = summary_row.insertCell()
        new_sum.textContent = "-"
        new_sum.id = `summary-${j}`
    }

    new_sum = summary_row.insertCell()
    new_sum.textContent = "-"
    new_sum.id = "grand-total"

    updateGrand()


    document.getElementById("grid-edit-table").addEventListener('input', event => updateCell(event.target));
}
// Editing the Grid{{{

function addChangeEntry(record_id) {
    index = changes.findIndex(change => change[3]["value"] == record_id)
    if(index == -1) {
        index = changes.length
        changes.push({3: {"value": record_id}})
    }
    return index
}

function updateCell(cell, newVal=null) {
    const rowIndex = cell.id.split("-")[0]; // Adjust for header row
    const record_id = data[rowIndex][0]

    const colIndex = cell.id.split("-")[1];
    if(newVal == null) {
        newVal = cell.textContent
    }

    if(colIndex == "delete") {
        index = addChangeEntry(record_id)
        changes[index][15] = {"value": cell.checked ? "" : invoice}
    } else {
        data[rowIndex][colIndex] = newVal
        addChange(rowIndex, colIndex)
        updateSummary(rowIndex, colIndex)
    }
}

function addChange(rowIndex, colIndex) {
    index = addChangeEntry(data[rowIndex][0])

    let field = fields[colIndex]
    changes[index][field] = {"value": data[rowIndex][colIndex]}
}//}}}

// Update summary stats {{{
function updateSummary(rowIndex, colIndex) {
    // if(field_names[colIndex]=="Edit Price") {
    //     sum = data.reduce((acc, elt) => acc + elt[colIndex], 0)
    //     document.getElementById(`summary-${colIndex}`).textContent = sum
    // }
    updateSubtotal(rowIndex);
    updateGrand();
}

function noNull(x) {
    if(isNaN(x)) {
        return 0
    }
    return x
}

function updateSubtotal(rowIndex) { 
    subtotals[rowIndex] = noNull(data[rowIndex][5] * data[rowIndex][7])

    document.getElementById(`${rowIndex}-subtotal`).textContent = subtotals[rowIndex]
}

function updateGrand() { 
    grandTotal = subtotals.reduce((acc,elt) => acc + elt, 0)
    document.getElementById(`grand-total`).textContent = grandTotal
}
//}}}



function saveData() {
    for(let i = 0; i<changes.length; i++) {
        if(changes[i][3]["value"] < 0) {
            delete changes[i][3]

            // Change the related invoice
            changes[i][15] = {}
            changes[i][15]["value"] = invoice;
        }
    }
    addRecords(SCHEMA["Lines"]["id"], changes)
    changes = []
}

function newLine(values=default_vals) {
    newRowIndex = data.length

    data.push(structuredClone(values))
    data[newRowIndex][0] = nextid
    
    for(let j = 1; j < field_names.length; j++) {
        addChange(newRowIndex, j)
    }

    genRow(newRowIndex)
    nextid -= 1;
}

function genRow(rowIndex) {
    // Visually generate the new row and update values
    table = document.getElementById("grid-edit-table")
    r = table.insertRow(rowIndex + 1)

    for(let j = 1; j<field_names.length; j++) {
        c = r.insertCell()
        c.id = `${rowIndex}-${j}`
        c.setAttribute("contenteditable", "")
        c.textContent = data[rowIndex][j]
        if(fields[j] == 6) {
            x = c
            c.onclick = function() {openActivity(x)}
            c.textContent = activities[data[rowIndex][j]]
            c.removeAttribute("contenteditable","")
        }
    }
    c = r.insertCell()
    c.id = `${rowIndex}-subtotal`

    c = r.insertCell()
    c.innerHTML = `<input id="${rowIndex}-delete" type=checkbox>`

    updateSubtotal(rowIndex);
}

//}}}

// Schema Puller{{{

function getSchema() {
    console.log("not implemented yet")
}

//}}}

// Activities {{{
function getActivities() {
    return queryQuickbase({
        "from": SCHEMA["Activities"]["id"],
        "select": [3,15],
        "where": "{16.EX.1}"
    }).then(resj => {handleActivities(resj["data"])})
}
function handleActivities(resj) {
    for(var i=0; i<resj.length; i++) {
        var opt = document.createElement("option");
        opt.value = resj[i][3]["value"];
        opt.innerHTML = resj[i][15]["value"];
        activities[resj[i][3]["value"]] = resj[i][15]["value"]
        $("#activities").append(opt);
    }
}

let modifying;
function openActivity(c) {
    $(".popup").show() 
    $("#activities").val(data[c.id.split("-")[0]][c.id.split("-")[1]])
    modifying=c
}
function saveActivity() {
    modifying.innerHTML = activities[$("#activities").val()]
    updateCell(modifying, $("#activities").val())

    record_id = data[modifying.id.split("-")[0]][0]
    addChangeEntry(record_id)
    addChange(modifying.id.split("-")[0], modifying.id.split("-")[1])
    $(".popup").hide()
}
function cancelActivity() {
    $(".popup").hide()
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

