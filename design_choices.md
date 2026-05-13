### Visualization design

#### Data Pre-processing
Before implementing the visualizations, we performed a thorough data audit to understand the dataset's structure.
**Initial Scope:** There are 119 unique teams that have competed in the Winter Olympics over the years across 17 different sports.

**Sport Consolidation:** Our research indicated that "Military Ski Patrol" was the precursor to "Biathlon." To maintain historical and analytical consistency, we merged these into a single "Biathlon" category.

**Data Cleaning:** We identified "Alpinism" as an honorary distinction for mountaineering rather than a competitive Olympic sport. Therefore, we removed these entries to focus on standardized athletic competition, resulting in 15 unique sports.

#### Question 1: Bodily Attributes and Success
To investigate whether successful athletes possess specific bodily attributes, we utilized a scatter plot. This choice is justified because our primary variables—"Height" and "Weight"—are both quantitative continuous data. Scatter plots are the most effective visual encoding for identifying correlations or "clusters" between two quantitative variables.


**Filtering for Success:** We filtered the dataset to include only medalists. By focusing on those who achieved "success" (winning a medal), we can better identify if specific physical attributes correlate with podium finishes.

**Faceting by Gender:** We partitioned the data into two separate plots (small multiples) for men and women. This is a faceting technique necessary because biological differences in body proportions would otherwise hide trends within each gender group.

_**Marks**_
- **Points:** They represent an athlete that has a certain weight and height combination.

_**Channels**_
- **Vertical Position:** Encodes the height of the athlete in centimeters (cm).
- **Horizontal Position:** Encodes the weight of the athlete in kilograms (kg).
- **Color Hue:** Encodes the categorical data of the medal typle, e.g, gold, silver, or bronze.

#### Question 2: Team Dominance in Winter Sports

To investigate whether certain sports are dominated by specific teams, we implemented a heatmap. This choice is justified because we are comparing a quantitative value (Medal Dominance) across two categorical dimensions: Teams (NOC) and Sports. Heatmaps are the most effective visual encoding for identifying patterns, outliers, and clusters within multi-dimensional categorical attributes.

**The Normalization Challenge:** A core challenge in this dataset is that medal availability varies  by sport (e.g., Speed Skating offers many medals, while Ice Hockey offers very few). To ensure a fair comparison, we moved beyond raw counts to a "Dominance" metric.

**Handling Team vs. Individual Sports:** Another challenge is that the dataset lists medals per athlete rather than per event. In a team sport like Ice Hockey, 10 athletes receive a medal for a single win, whereas in Figure Skating, one or two athletes receive a medal. To prevent team sports from being over-represented, we count medals based on the unique event to ensure that a team victory counts as one successful unit, regardless of how many athletes were involved.

**Calculating Dominance:** We calculated the "all-time record" for each sport by finding the maximum unique event medals ever won by a single team. Each cell in the heatmap represents a team’s current success as a percentage of that all-time record. This normalization allows a record-holding performance in a small sport to have the same visual impact as one in a large sport.

_**Marks**_
- **Area (Rectangle cell):** Each cell represents the intersection of a specific team and a specific sport.

_**Channels**_
- **Vertical Position:** Encodes the categorical attribute of the Team (NOC). The teams are sorted by their average dominance score to highlight the top-performing nations.
- **Horizontal Position:** Encodes the categorical attribute of the Sport.
- **Color Saturation (Sequential Scale):** Encodes the quantitative "Dominance" percentage. We utilized a sequential blue scale where darker saturation represents higher dominance and lighter tones represent lower success.

#### Question 3: Gender Popularity Across Teams and Sports

To investigate if certain sports are more popular for men or women within specific teams, we implemented a stacked bar chart coordinated with a vertical bar menu. This visualization allows for the comparison of a quantitative value (total athlete count) across two categorical dimensions (Sport and Gender).

**The Representation of Popularity:** We used the total number of athletes to determine a sport's popularity within a nation. By stacking the bars, we can simultaneously see the total scale of participation and the relative gender ratio.

**Faceting through Interaction:** Because showing 119 teams at once would be illegible, we used a faceting technique. The left-hand menu allows users to filter the main chart by the top 15 teams, instantly updating the gender distribution to reflect that specific team's participation.

_**Marks**_
- **Stacked Bar Segments:** The length of the bar segment represents the total number of athletes for a specific gender within a sport.

_**Channels**_
- **Vertical Position (y-axis):** Encodes the quantitative total count of athletes.
- **Horizontal Position (x-axis):** Encodes the categorical attribute of the Sport sorted by alphabetical order.
- **Color Hue:** Encodes the categorical attribute of Gender (Blue for Men, Pink for Women).

### Interaction design
#### Quesiton 1
We implemented four distinct interactions to facilitate data exploration:
1. **Zooming (Manipulation/Reducing):** Users can click and drag to select an area to zoom. We used coordinated views so that both the Men’s and Women’s plots scale together. A double-click resets the view.
2. **Sport Selection (Reducing):** Users can click a specific sport to isolate its height/weight distribution. This is a toggle interaction; clicking again resets the view.
3. **Medal Filtering (Reducing):** Users can select a medal type from the legend to view its specific distribution across the plots.
4. **Cross-View Coordination:** Selecting a sport on the heatmap automatically triggers the corresponding selection on the scatterplot, creating a coordinated multi-view.

#### Quesiton 2
We implemented the following interactions in the heatmap:
- **Filtering via Selection (Reducing):** Clicking a sport label on the x-axis triggers a filter on the coordinated scatter plots. This allows users to immediately see the physical attributes (Question 1) of the athletes belonging to the sports identified in the heatmap.
- **Semantic Highlighting:** Hovering over any cell reveals a tooltip. This tooltip provides the actual medal count, the specific sport/team name, and the calculated dominance percentage.

#### Question 3
The chart utilizes several interaction techniques to handle the complexity of the dataset:
- **Selection (Faceting):** Clicking on a team name in the left-hand bar menu updates the stacked bar chart. This allows users to compare, for example, the gender split of the USA versus Japan without leaving the view.
- **Details-on-Demand (Reducing):** Hovering over a specific colored segment of a bar triggers a tooltip. This reveals the exact count of men or women for that segemnt, providing high-precision data on top of the visual trend.
- **Visual Feedback (Manipulation):** The team selection menu uses color changes to indicate the active filter, providing clear state feedback to the user.