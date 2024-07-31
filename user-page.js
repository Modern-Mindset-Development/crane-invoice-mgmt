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
// }}}
// Global Variables {{{
let invoice = URLPARAMS.get('invoice');
let changes = [];
let nextid = -1;
let subtotals;
let activities= {}
let data = {};
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
function ulSearch(input_tag, list_tag) {
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
            getInvoiceInfo()
                .then(_ => loadEditor());
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
    if(res.length > 0) {
        $("#invoice-name").text(res[0][20]["value"]);
    } else {
        invoice = null
        startup()
    }
}

// }}}

// Grid Editor {{{
const qbFields = [3,11,6,19,26,18,31,12,32,21]
const qbDefault = {3: -1}

// -1 represents the subtotal field
// -2 represents the delete field
function Field(id, name) {
    this.id = id;
    this.name = name;
}
const displayFields = [
    new Field(26, "Line Number/Group"),
    new Field(11, "Date"),
    new Field(6, "Activity"),
    new Field(19, "Edit Description"),
    new Field(21, "Description"),
    new Field(18, "Price"),
    new Field(31, "Vendor Price"),
    new Field(12, "QTY"),
    new Field(-1, "Subtotal"),
    new Field(32, "Target Margin"),
    new Field(-2, "Delete")
]

function loadEditor() {
    showPage("loading")
    getLines().then(res => showPage("grid-editor"))
}

function getLines() {
    return queryQuickbase({
        "from": SCHEMA["Lines"]["id"],
        "select": qbFields,
        "where": `{15.EX.${invoice}}`
    }).then(resj => {handleLines(resj)})
}

function lineNumberSorter(recordA, recordB) {
    return recordA[26] > recordB[26]
}

function handleLines(resj) {
    let table = document.getElementById("grid-edit-table")
    table.innerHTML = ""

    data = resj["data"].map(record => {
        for(const field of Object.keys(record)) {
            record[field] = record[field]["value"]
        }
        return record
    })
    data.sort(lineNumberSorter)

    header_row = table.insertRow()
    for(let j = 0; j<displayFields.length; j++) {
        let new_header = document.createElement("th")
        new_header.textContent = displayFields[j].name
        header_row.append(new_header)
    }

    subtotals = new Array(data.length)
    for (let i = 0; i < data.length; i++) {
        genRow(i)
    }

    summary_row = table.insertRow()
    summary_row.id = "summary-row";
    for(let j = 1; j<displayFields.length; j++) {
        let new_sum = summary_row.insertCell()
        new_sum.textContent = "-"
        new_sum.id = `summary_${j}`
    }

    new_sum = summary_row.insertCell()
    new_sum.textContent = "-"
    new_sum.id = "grand-total"

    updateGrand()

    document.getElementById("grid-edit-table").addEventListener('input', event => updateData(event.target));
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

function updateData(cell, newVal=null, newText=null) {
    const rowIndex = cell.id.split("_")[0]; // Adjust for header row
    const displayField = cell.id.split("_")[1];
    const record_id = data[rowIndex][3]

    index = addChangeEntry(record_id)
    if(displayField == "delete") {
        changes[index][15] = {"value": cell.checked ? "" : invoice}
    } else {
        if(!newVal) {
            newVal = cell.textContent
        }
        if(!newText) {
            newText = newVal
        }
        cell.textContent = newText

        data[rowIndex][displayField] = newVal
        changes[index][displayField] = {"value": data[rowIndex][displayField]}
        updateSummary(rowIndex)
    }
}
//}}}

// Update summary stats {{{
function updateSummary(rowIndex) {
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
    subtotals[rowIndex] = noNull(data[rowIndex][18] * data[rowIndex][12])
    document.getElementById(`${rowIndex}_-1`).textContent = subtotals[rowIndex]
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
            if(changes[i][15]["value"] != invoice) {
                delete changes[i]
            }
        }
    }
    if(changes.length == 0) {
        alert("No changes to save")
    } else {
        addRecords(SCHEMA["Lines"]["id"], changes)
        changes = []
    }
}

function newLine(values=qbDefault) {
    dataRow = data.length

    data.push(structuredClone(values))
    data[dataRow][0] = nextid
    changeIndex = addChangeEntry(nextid)
    
    for(let j = 0; j < qbFields.length; j++) {
        if(data[dataRow][qbFields[j]]) {
            changes[changeIndex][qbFields[j]] = {"value": data[dataRow][qbFields[j]]}
        }
    }

    changes[index][15] = {"value": invoice}

    genRow(dataRow)
    nextid -= 1;
}

function genRow(rowIndex) {
    // Visually generate a new row and update values based on rowIndex of data array
    table = document.getElementById("grid-edit-table")
    r = table.insertRow(rowIndex + 1)

    for(let j = 0; j<displayFields.length; j++) {
        field = displayFields[j].id
        value = data[rowIndex][field]

        c = r.insertCell()
        c.id = `${rowIndex}_${field}`
        if(qbFields.includes(field)) {
            c.setAttribute("contenteditable", "")
            c.textContent = value
        }

        if(field == 6) {
            c.onclick = function() {openActivity(this)}
            c.textContent = value ? activities[value][15]["value"] : ""
            c.removeAttribute("contenteditable","")
        }
        if(field == -2) {
            c.innerHTML = `<input id="${rowIndex}_delete" type=checkbox>`
            c.removeAttribute("contenteditable","")
        }
    if(field == 21) {
        c.removeAttribute("contenteditable","")
    }
    }


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
        "select": [3,7,10,13,15],
        "where": "{16.EX.1}"
    }).then(resj => {handleActivities(resj["data"])})
}
function handleActivities(res) {
    let activitiesUl = $("#activity-list");

    activitiesUl.empty();
    for(let i = 0; i < res.length; i++) {
        activities[res[i][3]["value"]] = res[i]
        if(res[i][13]["value"] === "Category") {
            continue
        }
        let activityLi = $("<li></li>");
        activityLi.val(res[i][3]["value"]);
        activityLi.text(res[i][15]["value"]);

        activityLi.click(() => {
            activity = res[i][3]["value"];
            saveActivity(activity)
        });

        activitiesUl.append(activityLi)
    }
}

let modifying;
function openActivity(c) {
    $(".popup").show() 
    modifying=c
}
function saveActivity(activityId) {
    dataRow = modifying.id.split("_")[0]
    description_elt =document.getElementById(`${dataRow}_19`)
    price_elt = document.getElementById(`${dataRow}_18`)

    updateData(modifying, activityId, activities[activityId][15]["value"])
    updateData(description_elt, activities[activity][10]["value"])
    updateData(price_elt, activities[activity][7]["value"])
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

