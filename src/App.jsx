import React, { useEffect, useState } from "react";

export default function App() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchExpenses() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("http://localhost:8080/api/getMyExpenses", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ userId: "1" }),
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
                }

                const data = await res.json();
                if (!Array.isArray(data)) {
                    throw new Error("API did not return an array");
                }
                setExpenses(data);
            } catch (err) {
                setError(err.message || "Unknown error");
            } finally {
                setLoading(false);
            }
        }

        fetchExpenses();
    }, []);

    if (loading) return <div style={{ padding: 20 }}>Loading expenses...</div>;
    if (error) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;

    return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <h1>My Expenses</h1>
            {expenses.length === 0 ? (
                <div>No expenses found.</div>
            ) : (
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Name</th>
                            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "8px" }}>Amount</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map((e) => (
                            <tr key={e.expensesId ?? `${e.expenseDate}-${e.expenseName}-${Math.random()}`}>
                                <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{e.expenseName ?? '-'}</td>
                                <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                                    {typeof e.expenseAmount === "number" ? e.expenseAmount.toFixed(2) : (e.expenseAmount ?? '-')}
                                </td>
                                <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{e.expenseDate ?? '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}