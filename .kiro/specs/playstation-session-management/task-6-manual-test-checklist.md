# Task 6: Manual Testing Checklist

## Pre-Test Setup
- [ ] Ensure the application is running (frontend and backend)
- [ ] Ensure there are active tables in the system
- [ ] Ensure there is at least one PlayStation device available
- [ ] Open the PlayStation management page

## Test Suite 1: Link Session at Creation Time

### Test 1.1: Start Session WITH Table
**Steps:**
1. [ ] Click "بدء الجلسة" on an available PlayStation device
2. [ ] In the modal, select a table from the "ربط بطاولة" dropdown (e.g., Table 1)
3. [ ] Select number of controllers (e.g., 2)
4. [ ] Click "بدء الجلسة" button

**Expected Results:**
- [ ] Success notification appears: "✅ تم بدء الجلسة بنجاح"
- [ ] Device card shows session is active
- [ ] Device card displays: "مرتبطة بطاولة: 1" (or selected table number)
- [ ] Active sessions list shows the session with table icon and number
- [ ] Bill is created with the table number

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

### Test 1.2: Start Session WITHOUT Table
**Steps:**
1. [ ] Click "بدء الجلسة" on another available PlayStation device
2. [ ] In the modal, leave "ربط بطاولة" as "بدون طاولة"
3. [ ] Select number of controllers (e.g., 3)
4. [ ] Click "بدء الجلسة" button

**Expected Results:**
- [ ] Success notification appears: "✅ تم بدء الجلسة بنجاح"
- [ ] Device card shows session is active
- [ ] Device card displays: "غير مرتبطة بطاولة"
- [ ] Active sessions list shows the session with warning icon
- [ ] Bill is created without table number

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

## Test Suite 2: Link Active Session to Table

### Test 2.1: Link Unlinked Session to Table
**Prerequisites:** Have an active session WITHOUT a table (from Test 1.2)

**Steps:**
1. [ ] Locate the active session in the "الجلسات النشطة" section
2. [ ] Verify it shows "⚠️ غير مرتبطة بطاولة"
3. [ ] Click the "ربط طاولة" button
4. [ ] In the modal, select a table from the dropdown (e.g., Table 2)
5. [ ] Wait for the modal to close automatically

**Expected Results:**
- [ ] Success notification appears: "✅ تم ربط الجلسة بالطاولة 2 بنجاح"
- [ ] Modal closes automatically
- [ ] Session now displays: "🪑 مرتبطة بطاولة: 2"
- [ ] Device card updates to show table link
- [ ] Bill is updated with table number

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

### Test 2.2: Change Table Assignment
**Prerequisites:** Have an active session WITH a table (from Test 1.1 or Test 2.1)

**Steps:**
1. [ ] Locate the active session that is linked to a table
2. [ ] Note the current table number (e.g., Table 1)
3. [ ] Click the "ربط طاولة" button
4. [ ] Verify the dropdown shows the current table selected
5. [ ] Select a different table (e.g., Table 3)
6. [ ] Wait for the modal to close automatically

**Expected Results:**
- [ ] Dropdown initially shows current table selected
- [ ] Success notification appears: "✅ تم ربط الجلسة بالطاولة 3 بنجاح"
- [ ] Modal closes automatically
- [ ] Session now displays the new table number: "🪑 مرتبطة بطاولة: 3"
- [ ] Device card updates to show new table
- [ ] Bill is updated with new table number

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

### Test 2.3: Unlink Session from Table
**Prerequisites:** Have an active session WITH a table

**Steps:**
1. [ ] Locate the active session that is linked to a table
2. [ ] Click the "ربط طاولة" button
3. [ ] In the modal, select "بدون طاولة" from the dropdown
4. [ ] Wait for the modal to close automatically

**Expected Results:**
- [ ] Success notification appears: "✅ تم فك ربط الجلسة من الطاولة"
- [ ] Modal closes automatically
- [ ] Session now displays: "⚠️ غير مرتبطة بطاولة"
- [ ] Device card updates to show unlinked status
- [ ] Bill tableNumber is removed/set to null

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

## Test Suite 3: End Session Behavior

### Test 3.1: End Session WITH Table Link
**Prerequisites:** Have an active session WITH a table

**Steps:**
1. [ ] Locate an active session that is linked to a table
2. [ ] Click the "إنهاء الجلسة" button (or "إنهاء" in active sessions list)
3. [ ] Observe the behavior

**Expected Results:**
- [ ] Session ends IMMEDIATELY without showing customer name modal
- [ ] Success notification appears: "✅ تم إنهاء الجلسة بنجاح"
- [ ] Device becomes available
- [ ] Bill is finalized with table information
- [ ] Session disappears from active sessions list

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

### Test 3.2: End Session WITHOUT Table Link
**Prerequisites:** Have an active session WITHOUT a table

**Steps:**
1. [ ] Locate an active session that is NOT linked to a table
2. [ ] Click the "إنهاء الجلسة" button
3. [ ] Observe that a modal appears requesting customer name
4. [ ] Try clicking "إنهاء الجلسة" without entering a name
5. [ ] Enter a customer name (e.g., "أحمد محمد")
6. [ ] Click "إنهاء الجلسة" button

**Expected Results:**
- [ ] Modal appears with title "إنهاء الجلسة"
- [ ] Modal shows warning: "⚠️ هذه الجلسة غير مرتبطة بطاولة"
- [ ] Customer name field is required (shows red asterisk)
- [ ] Cannot proceed without entering name (button disabled or shows error)
- [ ] After entering name, session ends successfully
- [ ] Success notification appears
- [ ] Device becomes available
- [ ] Bill is finalized with customer name
- [ ] Session disappears from active sessions list

**Status:** ⬜ Pass / ⬜ Fail

**Notes:**
```
[Write any observations here]
```

---

## Test Suite 4: UI Display Verification

### Test 4.1: Device Card Display
**Steps:**
1. [ ] Start a session with a table
2. [ ] Observe the device card

**Expected Results:**
- [ ] Device card shows "🔵 نشط" status
- [ ] Shows real-time cost display
- [ ] Shows number of controllers
- [ ] Shows table link status with TableIcon
- [ ] Text is clear: "مرتبطة بطاولة: X" (blue color)

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 4.2: Active Sessions List Display
**Steps:**
1. [ ] Have at least one active session with table and one without
2. [ ] Observe the "الجلسات النشطة" section

**Expected Results:**
- [ ] Each session shows device name
- [ ] Shows number of controllers and start time
- [ ] Shows bill number in green
- [ ] Linked sessions show: "🪑 مرتبطة بطاولة: X" (blue color)
- [ ] Unlinked sessions show: "⚠️ غير مرتبطة بطاولة" (gray color)
- [ ] "ربط طاولة" button is visible and clickable
- [ ] Real-time cost is displayed

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 4.3: Modal UI Elements
**Steps:**
1. [ ] Open new session modal
2. [ ] Open link table modal
3. [ ] Open end session modal (for unlinked session)

**Expected Results:**

**New Session Modal:**
- [ ] Has "ربط بطاولة (اختياري)" dropdown
- [ ] Dropdown shows "بدون طاولة" as first option
- [ ] Lists all active tables sorted by number
- [ ] Clear and responsive design

**Link Table Modal:**
- [ ] Shows session device name
- [ ] Shows bill number
- [ ] Dropdown shows current table selected
- [ ] Can change selection
- [ ] Auto-saves on change
- [ ] Has cancel button

**End Session Modal:**
- [ ] Shows device name and details
- [ ] Shows warning message for unlinked sessions
- [ ] Customer name field with red asterisk
- [ ] Validation prevents empty submission
- [ ] Has cancel and confirm buttons

**Status:** ⬜ Pass / ⬜ Fail

---

## Test Suite 5: Error Handling

### Test 5.1: Network Error During Link
**Steps:**
1. [ ] Disconnect from network or stop backend
2. [ ] Try to link a session to a table
3. [ ] Observe error handling

**Expected Results:**
- [ ] Error notification appears with clear message
- [ ] Modal remains open or closes gracefully
- [ ] Session state doesn't change
- [ ] User can retry after reconnecting

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 5.2: Invalid Table Selection
**Steps:**
1. [ ] Try to link session to a table that doesn't exist (if possible)
2. [ ] Observe error handling

**Expected Results:**
- [ ] Error notification appears
- [ ] Session remains in previous state
- [ ] User can try again

**Status:** ⬜ Pass / ⬜ Fail

---

## Test Suite 6: Data Persistence

### Test 6.1: Page Reload with Linked Session
**Steps:**
1. [ ] Start a session with a table
2. [ ] Reload the page (F5 or Ctrl+R)
3. [ ] Wait for data to load

**Expected Results:**
- [ ] Session is still active after reload
- [ ] Table link status is preserved
- [ ] Bill association is maintained
- [ ] Cost is recalculated correctly
- [ ] All UI elements display correctly

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 6.2: Page Reload with Unlinked Session
**Steps:**
1. [ ] Start a session without a table
2. [ ] Reload the page
3. [ ] Wait for data to load

**Expected Results:**
- [ ] Session is still active after reload
- [ ] Shows "غير مرتبطة بطاولة" status
- [ ] Can still link to table after reload
- [ ] Cost is recalculated correctly

**Status:** ⬜ Pass / ⬜ Fail

---

## Test Suite 7: Integration with Billing

### Test 7.1: Check Bill in Billing Page
**Steps:**
1. [ ] Start a session with a table
2. [ ] Navigate to Billing page
3. [ ] Find the bill for this session

**Expected Results:**
- [ ] Bill exists in billing page
- [ ] Bill shows correct table number
- [ ] Bill type is "playstation"
- [ ] Bill shows session details
- [ ] Bill updates in real-time as session continues

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 7.2: Bill Update After Linking
**Steps:**
1. [ ] Start a session without a table
2. [ ] Check the bill in Billing page (note: no table number)
3. [ ] Go back to PlayStation page
4. [ ] Link the session to a table
5. [ ] Return to Billing page

**Expected Results:**
- [ ] Bill now shows the table number
- [ ] Bill details are updated
- [ ] No duplicate bills created
- [ ] Bill status remains correct

**Status:** ⬜ Pass / ⬜ Fail

---

## Summary

### Overall Test Results
- Total Tests: 19
- Passed: ___
- Failed: ___
- Skipped: ___

### Critical Issues Found
```
[List any critical issues that prevent functionality]
```

### Minor Issues Found
```
[List any minor issues or improvements needed]
```

### Recommendations
```
[Any recommendations for improvements]
```

### Conclusion
⬜ All tests passed - Task 6 is COMPLETE
⬜ Some tests failed - Issues need to be addressed
⬜ Cannot complete testing - Blockers exist

---

**Tester Name:** _______________
**Date:** _______________
**Environment:** Development / Staging / Production
**Browser:** _______________
**Notes:**
```
[Additional notes]
```
